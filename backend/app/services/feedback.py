from __future__ import annotations

import hashlib
import uuid
from typing import Any

import pandas as pd

from ..models import DemoSession, utc_now
from ..store import log_event, put_session


def make_candidate_id(dataset_name: str, head: str, relation: str, tail: str) -> str:
    raw = f"{dataset_name}||{head}||{relation}||{tail}"
    return hashlib.sha1(raw.encode("utf-8")).hexdigest()[:16]


def triple_key(head: str, relation: str, tail: str) -> str:
    return f"{head}||{relation}||{tail}"


def normalize_decision(decision: str) -> str:
    normalized = decision.strip().lower()
    if normalized not in {"accept", "reject", "uncertain", "correct"}:
        raise ValueError("decision must be accept, reject, uncertain, or correct")
    return normalized


def _safe_records(df: pd.DataFrame | None) -> pd.DataFrame:
    if df is None or len(df) == 0:
        return pd.DataFrame()
    return df.copy()


def find_llm_candidate(session: DemoSession, candidate_id: str, head: str, relation: str, tail: str) -> dict[str, Any]:
    llm_artifact = session.artifacts.get("llm")
    if not llm_artifact:
        return {}

    df = _safe_records(llm_artifact.get("evaluated_df"))
    if df.empty:
        return {}

    work = df.copy()
    if "candidate_id" not in work.columns:
        work["candidate_id"] = work.apply(
            lambda row: make_candidate_id(
                session.dataset_name,
                str(row.get("Head", "")),
                str(row.get("Relation", "")),
                str(row.get("Tail", "")),
            ),
            axis=1,
        )

    matched = work[work["candidate_id"].astype(str) == str(candidate_id)]
    if matched.empty:
        key = triple_key(head, relation, tail)
        matched = work[
            work[["Head", "Relation", "Tail"]]
            .astype(str)
            .agg("||".join, axis=1)
            == key
        ]
    if matched.empty:
        return {}

    row = matched.iloc[0].to_dict()
    return {
        "decision": row.get("decision"),
        "parsed_score": row.get("parsed_score"),
        "strategy": llm_artifact.get("strategy"),
        "format": llm_artifact.get("mode"),
        "top_k": llm_artifact.get("top_k"),
        "rationale": row.get("rationale"),
        "retrieved_context": row.get("retrieved_context", []),
        "raw_response": row.get("raw_response"),
    }


def find_filtering_candidate(session: DemoSession, candidate_id: str, head: str, relation: str, tail: str) -> dict[str, Any]:
    artifact = session.artifacts.get("filtering")
    if not artifact:
        return {}
    scored_df = _safe_records(artifact.get("scored_candidates_df"))
    if scored_df.empty:
        return {}

    work = scored_df.copy()
    if "candidate_id" not in work.columns:
        work["candidate_id"] = work.apply(
            lambda row: make_candidate_id(
                session.dataset_name,
                str(row.get("Head", "")),
                str(row.get("Relation", "")),
                str(row.get("Tail", "")),
            ),
            axis=1,
        )

    matched = work[work["candidate_id"].astype(str) == str(candidate_id)]
    if matched.empty:
        key = triple_key(head, relation, tail)
        matched = work[
            work[["Head", "Relation", "Tail"]]
            .astype(str)
            .agg("||".join, axis=1)
            == key
        ]
    if matched.empty:
        return {}
    row = matched.iloc[0].to_dict()
    return {
        "distance": row.get("distance"),
        "threshold": row.get("threshold", artifact.get("threshold")),
        "passed": row.get("distance") is not None
        and artifact.get("threshold") is not None
        and float(row["distance"]) <= float(artifact["threshold"]),
    }


def compute_feedback_effect(event: dict[str, Any]) -> dict[str, Any]:
    decision = event["user"]["decision"]
    if decision == "accept":
        return {"bucket": "accepted", "applied_to_completed_kg": True, "provenance": "human_confirmed"}
    if decision == "reject":
        return {"bucket": "rejected", "applied_to_completed_kg": False, "provenance": "human_rejected"}
    if decision == "uncertain":
        return {"bucket": "review_queue", "applied_to_completed_kg": False, "provenance": "needs_expert_review"}
    if decision == "correct":
        return {"bucket": "corrected", "applied_to_completed_kg": True, "provenance": "human_corrected"}
    return {"bucket": "unknown", "applied_to_completed_kg": False, "provenance": "unknown"}


def record_feedback(
    session: DemoSession,
    *,
    candidate_id: str,
    head: str,
    relation: str,
    tail: str,
    decision: str,
    reason: str | None = None,
    comment: str | None = None,
    corrected_triple: dict[str, str] | None = None,
    user_confidence: str | None = None,
    evidence_judgement: str | None = None,
) -> dict[str, Any]:
    normalized_decision = normalize_decision(decision)
    if normalized_decision == "correct" and not corrected_triple:
        raise ValueError("corrected_triple is required when decision is correct")

    llm_info = find_llm_candidate(session, candidate_id, head, relation, tail)
    filtering_info = find_filtering_candidate(session, candidate_id, head, relation, tail)
    event = {
        "feedback_id": f"fb_{uuid.uuid4().hex[:12]}",
        "session_id": session.session_id,
        "dataset_name": session.dataset_name,
        "candidate_id": candidate_id,
        "triple": {"Head": head, "Relation": relation, "Tail": tail},
        "llm": {
            "decision": llm_info.get("decision"),
            "parsed_score": llm_info.get("parsed_score"),
            "strategy": llm_info.get("strategy"),
            "format": llm_info.get("format"),
            "top_k": llm_info.get("top_k"),
            "rationale": llm_info.get("rationale"),
            "retrieved_context": llm_info.get("retrieved_context", []),
            "raw_response": llm_info.get("raw_response"),
        },
        "filtering": {
            "distance": filtering_info.get("distance"),
            "threshold": filtering_info.get("threshold"),
            "passed": filtering_info.get("passed"),
        },
        "user": {
            "decision": normalized_decision,
            "reason": reason,
            "comment": comment,
            "confidence": user_confidence,
            "evidence_judgement": evidence_judgement,
            "corrected_triple": corrected_triple,
        },
        "timestamp": utc_now(),
    }
    event["effect"] = compute_feedback_effect(event)

    session.artifacts.setdefault("feedback_events", []).append(event)
    session.artifacts.setdefault("user_refinements", []).append(
        {
            "candidate_id": candidate_id,
            "Head": head,
            "Relation": relation,
            "Tail": tail,
            "decision": normalized_decision,
            "reason": reason,
            "comment": comment,
            "corrected_triple": corrected_triple,
            "timestamp": event["timestamp"],
        }
    )

    session.artifacts["feedback_priors"] = build_feedback_priors(session)
    session.artifacts["feedback_threshold"] = calibrate_threshold_from_feedback(session)
    session.artifacts["feedback_cluster_stats"] = build_cluster_feedback_stats(session)
    put_session(session)

    log_event(
        session,
        "human_feedback",
        "info",
        f"User feedback recorded: {normalized_decision}",
        {
            "candidate_id": candidate_id,
            "Head": head,
            "Relation": relation,
            "Tail": tail,
            "reason": reason,
            "has_correction": corrected_triple is not None,
        },
    )
    return event


def build_feedback_summary(events: list[dict[str, Any]]) -> dict[str, Any]:
    summary = {
        "total": len(events),
        "accepted": 0,
        "rejected": 0,
        "uncertain": 0,
        "corrected": 0,
        "llm_overridden": 0,
        "not_enough_evidence": 0,
    }
    for event in events:
        decision = event.get("user", {}).get("decision")
        llm_decision = str(event.get("llm", {}).get("decision") or "").lower()
        reason = event.get("user", {}).get("reason")
        if decision == "accept":
            summary["accepted"] += 1
        elif decision == "reject":
            summary["rejected"] += 1
        elif decision == "uncertain":
            summary["uncertain"] += 1
        elif decision == "correct":
            summary["corrected"] += 1

        if reason == "not_enough_evidence":
            summary["not_enough_evidence"] += 1

        if llm_decision in {"accepted", "valid"} and decision == "reject":
            summary["llm_overridden"] += 1
        if llm_decision in {"rejected", "invalid"} and decision == "accept":
            summary["llm_overridden"] += 1
    return summary


def build_feedback_diagnostics(events: list[dict[str, Any]]) -> dict[str, Any]:
    diagnostics = {
        "llm_false_positive": 0,
        "llm_false_negative": 0,
        "correction_needed": 0,
        "evidence_insufficient": 0,
        "agreement": 0,
        "total_reviewed": len(events),
        "agreement_rate": 0.0,
    }
    if not events:
        return diagnostics

    for event in events:
        llm_decision = str(event.get("llm", {}).get("decision") or "").lower()
        user_decision = event.get("user", {}).get("decision")
        reason = event.get("user", {}).get("reason")
        evidence = event.get("user", {}).get("evidence_judgement")
        if llm_decision in {"accepted", "valid"} and user_decision == "accept":
            diagnostics["agreement"] += 1
        if llm_decision in {"rejected", "invalid"} and user_decision == "reject":
            diagnostics["agreement"] += 1
        if llm_decision in {"accepted", "valid"} and user_decision == "reject":
            diagnostics["llm_false_positive"] += 1
        if llm_decision in {"rejected", "invalid"} and user_decision in {"accept", "correct"}:
            diagnostics["llm_false_negative"] += 1
        if user_decision == "correct":
            diagnostics["correction_needed"] += 1
        if reason == "not_enough_evidence" or evidence == "evidence_insufficient":
            diagnostics["evidence_insufficient"] += 1

    diagnostics["agreement_rate"] = diagnostics["agreement"] / max(diagnostics["total_reviewed"], 1)
    return diagnostics


def build_feedback_priors(session: DemoSession) -> dict[str, Any]:
    events = list(session.artifacts.get("feedback_events", []))
    relation_stats: dict[str, dict[str, int]] = {}
    dataset_accepted = 0
    dataset_total = 0
    for event in events:
        relation = event.get("triple", {}).get("Relation")
        decision = event.get("user", {}).get("decision")
        if not relation or not decision:
            continue
        label = 1 if decision in {"accept", "correct"} else 0
        relation_stats.setdefault(str(relation), {"accepted": 0, "total": 0})
        relation_stats[str(relation)]["accepted"] += label
        relation_stats[str(relation)]["total"] += 1
        dataset_accepted += label
        dataset_total += 1

    relation_prior = {
        relation: stats["accepted"] / max(stats["total"], 1)
        for relation, stats in relation_stats.items()
    }
    dataset_prior = dataset_accepted / max(dataset_total, 1) if dataset_total else 0.0
    return {
        "relation_prior": relation_prior,
        "dataset_prior": dataset_prior,
        "feedback_examples": dataset_total,
    }


def calibrate_threshold_from_feedback(session: DemoSession) -> dict[str, Any] | None:
    events = list(session.artifacts.get("feedback_events", []))
    llm_artifact = session.artifacts.get("llm")
    if not llm_artifact:
        return None

    llm_df = _safe_records(llm_artifact.get("evaluated_df"))
    if llm_df.empty:
        return None
    if "candidate_id" not in llm_df.columns:
        llm_df["candidate_id"] = llm_df.apply(
            lambda row: make_candidate_id(
                session.dataset_name,
                str(row.get("Head", "")),
                str(row.get("Relation", "")),
                str(row.get("Tail", "")),
            ),
            axis=1,
        )

    rows: list[dict[str, float]] = []
    for event in events:
        decision = event.get("user", {}).get("decision")
        if decision not in {"accept", "reject", "correct"}:
            continue
        candidate_id = event.get("candidate_id")
        matched = llm_df[llm_df["candidate_id"].astype(str) == str(candidate_id)]
        if matched.empty or "distance" not in matched.columns:
            continue
        distance = matched.iloc[0].get("distance")
        if distance is None or pd.isna(distance):
            continue
        label = 1 if decision in {"accept", "correct"} else 0
        rows.append({"distance": float(distance), "label": float(label)})

    if len(rows) < 5:
        return None

    distances = sorted({row["distance"] for row in rows})
    best: dict[str, Any] | None = None
    for threshold in distances:
        tp = fp = fn = 0
        for row in rows:
            prediction = 1 if row["distance"] <= threshold else 0
            label = int(row["label"])
            if prediction == 1 and label == 1:
                tp += 1
            elif prediction == 1 and label == 0:
                fp += 1
            elif prediction == 0 and label == 1:
                fn += 1
        precision = tp / max(tp + fp, 1)
        recall = tp / max(tp + fn, 1)
        f1 = 2 * precision * recall / max(precision + recall, 1e-9)
        candidate = {
            "threshold": threshold,
            "precision": precision,
            "recall": recall,
            "f1": f1,
            "feedback_examples": len(rows),
        }
        if best is None or candidate["f1"] > best["f1"]:
            best = candidate
    return best


def build_cluster_feedback_stats(session: DemoSession) -> dict[str, Any]:
    events = list(session.artifacts.get("feedback_events", []))
    stats: dict[str, dict[str, float]] = {}
    candidates_artifact = session.artifacts.get("candidates", {})
    candidates_df = _safe_records(candidates_artifact.get("candidates_df"))
    if candidates_df.empty:
        return {}
    if "candidate_id" not in candidates_df.columns:
        candidates_df["candidate_id"] = candidates_df.apply(
            lambda row: make_candidate_id(
                session.dataset_name,
                str(row.get("Head", "")),
                str(row.get("Relation", "")),
                str(row.get("Tail", "")),
            ),
            axis=1,
        )
    candidate_map = {
        str(row["candidate_id"]): row
        for _, row in candidates_df.iterrows()
    }

    for event in events:
        cid = str(event.get("candidate_id", ""))
        decision = event.get("user", {}).get("decision")
        if cid not in candidate_map or not decision:
            continue
        row = candidate_map[cid]
        cluster_ids = row.get("cluster_ids", [])
        if not isinstance(cluster_ids, list):
            cluster_ids = []
        for cluster_id in cluster_ids:
            key = str(cluster_id)
            stats.setdefault(
                key,
                {"accepted": 0.0, "rejected": 0.0, "uncertain": 0.0, "corrected": 0.0, "total": 0.0},
            )
            stats[key]["total"] += 1
            if decision == "accept":
                stats[key]["accepted"] += 1
            elif decision == "reject":
                stats[key]["rejected"] += 1
            elif decision == "uncertain":
                stats[key]["uncertain"] += 1
            elif decision == "correct":
                stats[key]["corrected"] += 1

    for value in stats.values():
        value["accept_rate"] = value["accepted"] / max(value["total"], 1.0)
        value["reject_rate"] = value["rejected"] / max(value["total"], 1.0)
    return stats

