from __future__ import annotations

import json
import time
from pathlib import Path
from typing import Any

import pandas as pd
import requests

from candidates_filtering import triple_filter
from candidates_generation import triple_gen

from ..config import (
    DEFAULT_LLM_LIMIT,
    DEFAULT_MODEL_NAME,
    DEFAULT_TOP_K,
    DEMO_CACHE_DIR,
)
from ..models import DemoSession
from ..store import log_event, update_step
from . import feedback as feedback_service

STRATEGY_LABELS = {
    "zero": "Zero-shot",
    "context": "Context",
    "rag": "RAG",
}


def _import_filtering():
    from experiment import filtering

    return filtering


def _import_prep_llm():
    from experiment import prep_llm

    return prep_llm


def _import_result_utils():
    from experiment import result as result_utils

    return result_utils


def _triple_key(df: pd.DataFrame) -> pd.Series:
    return df[["Head", "Relation", "Tail"]].astype(str).agg("||".join, axis=1)


def _ensure_known_csv(session: DemoSession) -> Path:
    path = DEMO_CACHE_DIR / f"{session.session_id}_known.csv"
    if not path.exists():
        session.known_df.to_csv(path, index=False)
    return path


def _display_entity(session: DemoSession, value: str) -> str:
    return session.entity_labels.get(value, value)


def _display_relation(session: DemoSession, value: str) -> str:
    return session.relation_labels.get(value, value.replace("/", " ").replace("_", " ").replace(".", " ").strip() or value)


def _to_records(session: DemoSession, df: pd.DataFrame) -> list[dict[str, Any]]:
    clean_df = df.copy()
    for column in clean_df.columns:
        clean_df[column] = clean_df[column].apply(
            lambda value: value if not isinstance(value, pd.Timestamp) else value.isoformat()
        )
    if {"Head", "Relation", "Tail"}.issubset(clean_df.columns):
        clean_df["DisplayHead"] = clean_df["Head"].map(lambda value: _display_entity(session, str(value)))
        clean_df["DisplayRelation"] = clean_df["Relation"].map(lambda value: _display_relation(session, str(value)))
        clean_df["DisplayTail"] = clean_df["Tail"].map(lambda value: _display_entity(session, str(value)))
    return json.loads(clean_df.to_json(orient="records"))


def ollama_status(model_name: str = DEFAULT_MODEL_NAME) -> dict[str, Any]:
    try:
        with requests.get("http://127.0.0.1:11434/api/tags", timeout=2) as response:
            response.raise_for_status()
            models = response.json().get("models", [])
        names = {item.get("name", "") for item in models}
        return {
            "available": True,
            "model_present": any(name.startswith(model_name) for name in names),
            "models": sorted(names),
        }
    except Exception as exc:  # pragma: no cover - depends on local Ollama daemon
        return {"available": False, "model_present": False, "error": str(exc), "models": []}


def _missing_mask(df: pd.DataFrame, missing_df: pd.DataFrame) -> pd.Series:
    if missing_df.empty:
        return pd.Series([False] * len(df), index=df.index)
    return _triple_key(df).isin(set(_triple_key(missing_df)))


def _run_lightweight_filter_fallback(
    session: DemoSession,
    filterable_df: pd.DataFrame,
    threshold: float | None,
    import_error: Exception,
) -> dict[str, Any]:
    scored_df = filterable_df.copy()
    rt_counts = session.known_df.groupby(["Relation", "Tail"])["Head"].nunique()
    head_degree = session.known_df.groupby("Head").size()
    relation_counts = session.known_df.groupby("Relation").size()

    def distance(row: pd.Series) -> float:
        rt_count = int(rt_counts.get((row["Relation"], row["Tail"]), 0))
        h_degree = int(head_degree.get(row["Head"], 0))
        r_count = int(relation_counts.get(row["Relation"], 0))
        return (1.0 / (1 + rt_count)) + (0.25 / (1 + h_degree)) + (0.10 / (1 + r_count))

    scored_df["distance"] = scored_df.apply(distance, axis=1)
    if threshold is None:
        distances = scored_df["distance"].astype(float)
        threshold_list = sorted(
            {
                float(distances.quantile(q)) + 1e-12
                for q in (0.10, 0.25, 0.50, 0.75, 0.90)
            }
            | {float(distances.max()) + 1e-12}
        )
        best_threshold, accepted_simple = triple_filter.filter_best_threshold(
            model=None,
            candidates_df=scored_df[["Head", "Relation", "Tail", "distance"]].copy(),
            missing_df=session.missing_df,
            train_df=pd.DataFrame(),
            threshold_list=threshold_list,
        )
    else:
        best_threshold = float(threshold)
        accepted_simple = triple_filter.filter_candidates(
            scored_df[["Head", "Relation", "Tail", "distance"]], best_threshold
        )

    accepted_keys = set(_triple_key(accepted_simple))
    accepted_df = scored_df[_triple_key(scored_df).isin(accepted_keys)].copy()
    rejected_df = scored_df[~_triple_key(scored_df).isin(accepted_keys)].copy()
    accepted_df["threshold"] = float(best_threshold)
    accepted_df["filter_decision"] = "accepted"
    accepted_df["status"] = "sent to LLM"
    rejected_df["threshold"] = float(best_threshold)
    rejected_df["filter_decision"] = "rejected"
    rejected_df["status"] = "filtered out"

    return {
        "enabled": True,
        "metadata": {
            "device": "cpu",
            "fallback": True,
            "reason": (
                "PyKEEN filtering dependencies are not installed. "
                f"Used lightweight structural fallback: {import_error}"
            ),
        },
        "threshold_diagnostics": [],
        "scored_candidates_df": scored_df,
        "accepted_df": accepted_df,
        "rejected_df": rejected_df,
        "threshold": float(best_threshold),
    }


def ensure_candidates(session: DemoSession) -> dict[str, Any]:
    if "candidates" in session.artifacts:
        return session.artifacts["candidates"]

    start = time.perf_counter()
    candidate_records = triple_gen.generate_candidate_records(session.known_df)
    if candidate_records.empty:
        payload = {
            "summary": {
                "generated_count": 0,
                "duplicate_existing_count": 0,
                "filter_queue_count": 0,
                "true_missing_count": 0,
                "false_candidate_count": 0,
            },
            "candidates_df": candidate_records,
            "filterable_df": candidate_records,
        }
        session.artifacts["candidates"] = payload
        return payload

    candidate_records = candidate_records.copy()
    candidate_records["candidate_id"] = candidate_records.apply(
        lambda row: feedback_service.make_candidate_id(
            session.dataset_name,
            str(row.get("Head", "")),
            str(row.get("Relation", "")),
            str(row.get("Tail", "")),
        ),
        axis=1,
    )
    candidate_records["Missing"] = _missing_mask(candidate_records, session.missing_df).astype(int)
    candidate_records["status"] = candidate_records.apply(
        lambda row: "duplicate existing" if row["status_duplicate_existing"] else "generated",
        axis=1,
    )
    candidate_records["status_filtered_out"] = False
    candidate_records["status_sent_to_llm"] = False
    candidate_records["status_accepted"] = False
    candidate_records["status_rejected"] = False
    candidate_records["status_unresolved"] = False
    filterable_df = candidate_records[~candidate_records["status_duplicate_existing"]].copy()

    payload = {
        "summary": {
            "generated_count": int(len(candidate_records)),
            "duplicate_existing_count": int(candidate_records["status_duplicate_existing"].sum()),
            "filter_queue_count": int(len(filterable_df)),
            "true_missing_count": int(candidate_records["Missing"].sum()),
            "false_candidate_count": int((candidate_records["Missing"] == 0).sum()),
        },
        "candidates_df": candidate_records,
        "filterable_df": filterable_df,
    }
    session.artifacts["candidates"] = payload
    runtime = time.perf_counter() - start
    update_step(
        session,
        "candidate_generation",
        status="completed",
        runtime_sec=runtime,
        input_count=len(session.known_df),
        output_count=len(filterable_df),
        explanation=(
            "Candidates are propagated across relation-tail clusters, deduplicated, and compared against the known graph."
        ),
    )
    log_event(
        session,
        "candidate_generation",
        "info",
        "Generated candidate triples with provenance.",
        payload["summary"],
    )
    return payload


def get_candidates_payload(session: DemoSession) -> dict[str, Any]:
    artifact = ensure_candidates(session)
    return {
        "summary": artifact["summary"],
        "candidates": _to_records(session, artifact["candidates_df"]),
    }


def run_filtering(
    session: DemoSession,
    *,
    enabled: bool = True,
    threshold: float | None = None,
    preferred_device: str | None = "cuda",
) -> dict[str, Any]:
    candidates_artifact = ensure_candidates(session)
    filterable_df = candidates_artifact["filterable_df"].copy()
    if filterable_df.empty:
        session.artifacts["filtering"] = {
            "enabled": enabled,
            "metadata": {},
            "threshold_diagnostics": [],
            "scored_candidates_df": filterable_df,
            "accepted_df": filterable_df,
            "rejected_df": filterable_df,
            "threshold": threshold,
        }
        return session.artifacts["filtering"]

    if not enabled:
        filterable_df["threshold"] = None
        filterable_df["filter_decision"] = "accepted"
        filterable_df["status"] = "sent to LLM"
        artifact = {
            "enabled": False,
            "metadata": {"filtering_disabled": True},
            "threshold_diagnostics": [],
            "scored_candidates_df": filterable_df,
            "accepted_df": filterable_df.copy(),
            "rejected_df": filterable_df.iloc[0:0].copy(),
            "threshold": None,
        }
        session.artifacts["filtering"] = artifact
        update_step(
            session,
            "transe_filtering",
            status="completed",
            input_count=len(filterable_df),
            output_count=len(filterable_df),
            explanation="Filtering was disabled for demo mode, so every generated candidate moves to LLM validation.",
        )
        log_event(
            session,
            "transe_filtering",
            "warning",
            "Filtering disabled in demo mode.",
        )
        return artifact

    start = time.perf_counter()
    base_df = filterable_df[["Head", "Relation", "Tail"]].copy()
    try:
        filtering = _import_filtering()
        pipeline_result = filtering.run_filter_pipeline(
            session.known_df,
            base_df,
            session.missing_df,
            preferred_device=preferred_device,
            use_wandb=False,
        )
        scored_df = filterable_df.merge(
            pipeline_result["scored_candidates_df"],
            on=["Head", "Relation", "Tail"],
            how="left",
        )
    except (ModuleNotFoundError, AttributeError) as exc:
        artifact = _run_lightweight_filter_fallback(session, filterable_df, threshold, exc)
        artifact["runtime_sec"] = time.perf_counter() - start
        session.artifacts["filtering"] = artifact
        update_step(
            session,
            "transe_filtering",
            status="completed",
            runtime_sec=artifact["runtime_sec"],
            input_count=len(filterable_df),
            output_count=len(artifact["accepted_df"]),
            explanation="Filtering used a lightweight structural fallback because PyKEEN was unavailable.",
        )
        log_event(
            session,
            "transe_filtering",
            "warning",
            "PyKEEN unavailable. Used lightweight filtering fallback.",
            artifact["metadata"],
        )
        return artifact

    best_threshold = float(
        threshold
        if threshold is not None
        else pipeline_result.get("threshold", pipeline_result["metadata"].get("threshold"))
    )
    threshold_diagnostics = pipeline_result["threshold_diagnostics"]
    if threshold is not None:
        accepted_simple = triple_filter.filter_candidates(
            scored_df[["Head", "Relation", "Tail", "distance"]], threshold
        )
        accepted_keys = set(_triple_key(accepted_simple))
        accepted_df = scored_df[_triple_key(scored_df).isin(accepted_keys)].copy()
        rejected_df = scored_df[~_triple_key(scored_df).isin(accepted_keys)].copy()
    else:
        accepted_keys = set(_triple_key(pipeline_result["accepted_df"]))
        accepted_df = scored_df[_triple_key(scored_df).isin(accepted_keys)].copy()
        rejected_df = scored_df[~_triple_key(scored_df).isin(accepted_keys)].copy()

    accepted_df["threshold"] = best_threshold
    accepted_df["filter_decision"] = "accepted"
    accepted_df["status"] = "sent to LLM"
    rejected_df["threshold"] = best_threshold
    rejected_df["filter_decision"] = "rejected"
    rejected_df["status"] = "filtered out"
    runtime = time.perf_counter() - start

    artifact = {
        "enabled": True,
        "metadata": {
            key: float(value) if hasattr(value, "item") else value
            for key, value in pipeline_result["metadata"].items()
        },
        "threshold_diagnostics": threshold_diagnostics,
        "scored_candidates_df": scored_df,
        "accepted_df": accepted_df,
        "rejected_df": rejected_df,
        "threshold": best_threshold,
        "runtime_sec": runtime,
    }
    session.artifacts["filtering"] = artifact

    all_candidates = candidates_artifact["candidates_df"].copy()
    filtered_keys = set(_triple_key(rejected_df))
    accepted_keys = set(_triple_key(accepted_df))
    all_keys = _triple_key(all_candidates)
    all_candidates["distance"] = scored_df.set_index(["Head", "Relation", "Tail"])["distance"].reindex(
        list(zip(all_candidates["Head"], all_candidates["Relation"], all_candidates["Tail"]))
    ).to_numpy()
    all_candidates["threshold"] = best_threshold
    all_candidates["status_filtered_out"] = all_keys.isin(filtered_keys)
    all_candidates.loc[all_keys.isin(accepted_keys), "status"] = "sent to filter"
    all_candidates.loc[all_keys.isin(filtered_keys), "status"] = "filtered out"
    candidates_artifact["candidates_df"] = all_candidates

    update_step(
        session,
        "transe_filtering",
        status="completed",
        runtime_sec=runtime,
        input_count=len(filterable_df),
        output_count=len(accepted_df),
        explanation=(
            "TransE scores each candidate with ||h + r - t|| and keeps the threshold that best balances coverage and reduction."
        ),
    )
    log_event(
        session,
        "transe_filtering",
        "info",
        "Completed TransE filtering.",
        {
            "threshold": best_threshold,
            "accepted": len(accepted_df),
            "rejected": len(rejected_df),
            "device": pipeline_result["metadata"]["device"],
        },
    )
    return artifact


def get_filter_payload(
    session: DemoSession,
    *,
    enabled: bool = True,
    threshold: float | None = None,
    preferred_device: str | None = "cuda",
) -> dict[str, Any]:
    artifact = run_filtering(
        session,
        enabled=enabled,
        threshold=threshold,
        preferred_device=preferred_device,
    )
    scored_df = artifact["scored_candidates_df"]
    distances = (
        [float(value) for value in scored_df["distance"].dropna().tolist()]
        if "distance" in scored_df.columns
        else []
    )
    return {
        "enabled": artifact["enabled"],
        "model_info": artifact["metadata"],
        "threshold": float(artifact["threshold"]) if artifact["threshold"] is not None else None,
        "threshold_diagnostics": artifact["threshold_diagnostics"],
        "accepted_count": int(len(artifact["accepted_df"])),
        "rejected_count": int(len(artifact["rejected_df"])),
        "distances": distances,
        "candidates": _to_records(session, scored_df.sort_values("distance") if "distance" in scored_df.columns else scored_df),
        "runtime_sec": artifact.get("runtime_sec"),
    }


def _prepare_llm_input(
    session: DemoSession,
    *,
    max_candidates: int,
    use_filter_results: bool,
) -> pd.DataFrame:
    filtering_artifact = session.artifacts.get("filtering")
    if use_filter_results and filtering_artifact is None:
        filtering_artifact = run_filtering(session)

    if use_filter_results and filtering_artifact is not None:
        llm_input_df = filtering_artifact["accepted_df"].copy()
    else:
        llm_input_df = ensure_candidates(session)["filterable_df"].copy()

    return llm_input_df.head(max_candidates).reset_index(drop=True)


def _empty_llm_artifact(
    *,
    format_name: str,
    strategy: str,
    top_k: int,
    model_name: str,
    is_mock: bool,
    evaluated_df: pd.DataFrame,
) -> dict[str, Any]:
    return {
        "mode": format_name,
        "strategy": strategy,
        "top_k": top_k,
        "strategy_label": STRATEGY_LABELS.get(strategy, strategy.title()),
        "model_name": model_name,
        "is_mock": is_mock,
        "evaluated_df": evaluated_df.copy(),
        "summary": {"accepted": 0, "rejected": 0, "unresolved": 0},
        "runtime_sec": 0.0,
        "ollama": ollama_status(model_name),
    }


def _evaluate_llm_candidates(
    session: DemoSession,
    llm_input_df: pd.DataFrame,
    *,
    format_name: str,
    strategy: str,
    top_k: int,
    model_name: str,
    force_mock: bool,
) -> dict[str, Any]:
    prep_llm = _import_prep_llm()
    llm_input_df = llm_input_df.copy().reset_index(drop=True)
    if llm_input_df.empty:
        return _empty_llm_artifact(
            format_name=format_name,
            strategy=strategy,
            top_k=top_k,
            model_name=model_name,
            is_mock=force_mock,
            evaluated_df=llm_input_df,
        )

    ollama_info = ollama_status(model_name)
    requested_mock = force_mock or not (ollama_info["available"] and ollama_info["model_present"])
    mock = requested_mock

    start = time.perf_counter()
    fallback_error: str | None = None
    try:
        retriever = None
        if strategy == "rag":
            retriever = prep_llm.create_retriever(str(_ensure_known_csv(session)), top_k=top_k)

        llm_input_df["threshold"] = llm_input_df.get("threshold")
        evaluated_df = prep_llm.evaluate_candidates(
            llm_input_df,
            original_df=session.known_df if strategy == "context" else None,
            format_name=format_name,
            strategy=strategy,
            retriever=retriever,
            top_k=top_k,
            model_name=model_name,
            mock=mock,
        )
    except Exception as exc:
        if requested_mock:
            raise
        fallback_error = str(exc)
        mock = True
        retriever = None
        if strategy == "rag":
            retriever = prep_llm.create_retriever(str(_ensure_known_csv(session)), top_k=top_k)
        llm_input_df["threshold"] = llm_input_df.get("threshold")
        evaluated_df = prep_llm.evaluate_candidates(
            llm_input_df,
            original_df=session.known_df if strategy == "context" else None,
            format_name=format_name,
            strategy=strategy,
            retriever=retriever,
            top_k=top_k,
            model_name=model_name,
            mock=True,
        )
        ollama_info = {**ollama_info, "fallback_error": fallback_error}
    runtime = time.perf_counter() - start
    if "candidate_id" not in evaluated_df.columns:
        evaluated_df["candidate_id"] = evaluated_df.apply(
            lambda row: feedback_service.make_candidate_id(
                session.dataset_name,
                str(row.get("Head", "")),
                str(row.get("Relation", "")),
                str(row.get("Tail", "")),
            ),
            axis=1,
        )

    summary = {
        "accepted": int((evaluated_df["decision"] == "accepted").sum()),
        "rejected": int((evaluated_df["decision"] == "rejected").sum()),
        "unresolved": int((evaluated_df["decision"] == "unresolved").sum()),
    }
    return {
        "mode": format_name,
        "strategy": strategy,
        "top_k": top_k,
        "strategy_label": STRATEGY_LABELS.get(strategy, strategy.title()),
        "model_name": model_name,
        "is_mock": mock,
        "evaluated_df": evaluated_df,
        "summary": summary,
        "runtime_sec": runtime,
        "ollama": ollama_info,
    }


def run_llm_validation(
    session: DemoSession,
    *,
    format_name: str = "triples",
    strategy: str = "rag",
    top_k: int = DEFAULT_TOP_K,
    model_name: str = DEFAULT_MODEL_NAME,
    max_candidates: int = DEFAULT_LLM_LIMIT,
    force_mock: bool = False,
    use_filter_results: bool = True,
) -> dict[str, Any]:
    llm_input_df = _prepare_llm_input(
        session,
        max_candidates=max_candidates,
        use_filter_results=use_filter_results,
    )
    artifact = _evaluate_llm_candidates(
        session,
        llm_input_df,
        format_name=format_name,
        strategy=strategy,
        top_k=top_k,
        model_name=model_name,
        force_mock=force_mock,
    )
    session.artifacts["llm"] = artifact

    evaluated_df = artifact["evaluated_df"]
    summary = artifact["summary"]
    runtime = artifact["runtime_sec"]
    mock = artifact["is_mock"]
    fallback_error = artifact["ollama"].get("fallback_error") if isinstance(artifact.get("ollama"), dict) else None

    candidates_artifact = ensure_candidates(session)
    all_candidates = candidates_artifact["candidates_df"].copy()
    evaluated_keys = set(_triple_key(evaluated_df))
    if "decision" in evaluated_df.columns:
        accepted_keys = set(_triple_key(evaluated_df[evaluated_df["decision"] == "accepted"]))
        rejected_keys = set(_triple_key(evaluated_df[evaluated_df["decision"] == "rejected"]))
        unresolved_keys = set(_triple_key(evaluated_df[evaluated_df["decision"] == "unresolved"]))
    else:
        accepted_keys = set()
        rejected_keys = set()
        unresolved_keys = set()
    all_keys = _triple_key(all_candidates)
    all_candidates.loc[all_keys.isin(evaluated_keys), "status_sent_to_llm"] = True
    all_candidates.loc[all_keys.isin(accepted_keys), "status_accepted"] = True
    all_candidates.loc[all_keys.isin(rejected_keys), "status_rejected"] = True
    all_candidates.loc[all_keys.isin(unresolved_keys), "status_unresolved"] = True
    all_candidates.loc[all_keys.isin(accepted_keys), "status"] = "accepted"
    all_candidates.loc[all_keys.isin(rejected_keys), "status"] = "rejected"
    all_candidates.loc[all_keys.isin(unresolved_keys), "status"] = "unresolved"
    candidates_artifact["candidates_df"] = all_candidates

    update_step(
        session,
        "llm_validation",
        status="completed",
        runtime_sec=runtime,
        input_count=len(llm_input_df),
        output_count=summary["accepted"],
        explanation=(
            "Candidates are validated by the LLM with zero-shot, context, or RAG prompts while exposing prompts, context, and raw responses."
        ),
    )
    log_event(
        session,
        "llm_validation",
        "warning" if mock else "info",
        "Completed LLM validation." if not mock else "Ollama unavailable or model missing. Using MOCK validation.",
        {
            "mode": format_name,
            "strategy": strategy,
            "top_k": top_k,
            "evaluated_candidates": len(evaluated_df),
            "mock": mock,
        },
    )
    if fallback_error:
        log_event(
            session,
            "llm_validation",
            "warning",
            "Real Ollama validation failed. Falling back to MOCK mode.",
            {"error": fallback_error},
        )
    return artifact


def get_llm_payload(
    session: DemoSession,
    *,
    format_name: str = "triples",
    strategy: str = "rag",
    top_k: int = DEFAULT_TOP_K,
    model_name: str = DEFAULT_MODEL_NAME,
    max_candidates: int = DEFAULT_LLM_LIMIT,
    force_mock: bool = False,
    use_filter_results: bool = True,
) -> dict[str, Any]:
    artifact = run_llm_validation(
        session,
        format_name=format_name,
        strategy=strategy,
        top_k=top_k,
        model_name=model_name,
        max_candidates=max_candidates,
        force_mock=force_mock,
        use_filter_results=use_filter_results,
    )
    return {
        "mode": artifact["mode"],
        "strategy": artifact["strategy"],
        "strategy_label": artifact["strategy_label"],
        "top_k": artifact["top_k"],
        "model_name": artifact["model_name"],
        "is_mock": artifact["is_mock"],
        "summary": artifact["summary"],
        "runtime_sec": artifact["runtime_sec"],
        "ollama": artifact["ollama"],
        "candidates": _to_records(session, artifact["evaluated_df"]),
    }


def get_llm_comparison_payload(
    session: DemoSession,
    *,
    format_name: str = "triples",
    top_k: int = DEFAULT_TOP_K,
    model_name: str = DEFAULT_MODEL_NAME,
    max_candidates: int = DEFAULT_LLM_LIMIT,
    force_mock: bool = False,
    use_filter_results: bool = True,
) -> dict[str, Any]:
    llm_input_df = _prepare_llm_input(
        session,
        max_candidates=max_candidates,
        use_filter_results=use_filter_results,
    )
    strategies: list[dict[str, Any]] = []
    for strategy_name in ("zero", "context", "rag"):
        artifact = _evaluate_llm_candidates(
            session,
            llm_input_df,
            format_name=format_name,
            strategy=strategy_name,
            top_k=top_k,
            model_name=model_name,
            force_mock=force_mock,
        )
        candidates = _to_records(session, artifact["evaluated_df"])
        strategies.append(
            {
                "strategy": strategy_name,
                "label": artifact["strategy_label"],
                "summary": artifact["summary"],
                "runtime_sec": artifact["runtime_sec"],
                "is_mock": artifact["is_mock"],
                "candidate_count": len(artifact["evaluated_df"]),
                "top_k": top_k if strategy_name == "rag" else None,
                "ollama": artifact["ollama"],
                "focus_candidate": candidates[0] if candidates else None,
            }
        )

    return {
        "mode": format_name,
        "model_name": model_name,
        "candidate_count": int(len(llm_input_df)),
        "use_filter_results": use_filter_results,
        "strategies": strategies,
    }


def _apply_user_feedback(
    session: DemoSession,
    additions_df: pd.DataFrame,
    rejected_df: pd.DataFrame,
    unresolved_df: pd.DataFrame,
) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    events: list[dict[str, Any]] = list(session.artifacts.get("feedback_events") or [])
    legacy_refs: list[dict[str, Any]] = list(session.artifacts.get("user_refinements") or [])
    if not events and not legacy_refs:
        return additions_df, rejected_df, unresolved_df

    additions = additions_df.copy()
    rejected = rejected_df.copy()
    unresolved = unresolved_df.copy()
    known_keys = set(_triple_key(session.known_df[["Head", "Relation", "Tail"]]))

    def ensure_columns(frame: pd.DataFrame, extra: dict[str, Any]) -> pd.DataFrame:
        if frame.empty:
            return pd.DataFrame(columns=list({*frame.columns.tolist(), *extra.keys()}))
        for key in extra:
            if key not in frame.columns:
                frame[key] = None
        return frame

    def rows_to_keys(frame: pd.DataFrame) -> pd.Series:
        if frame.empty:
            return pd.Series(dtype=object)
        return _triple_key(frame[["Head", "Relation", "Tail"]])

    def remove_key(frame: pd.DataFrame, key: str) -> pd.DataFrame:
        if frame.empty:
            return frame
        return frame[rows_to_keys(frame) != key].copy()

    def append_row(frame: pd.DataFrame, row: dict[str, Any]) -> pd.DataFrame:
        key = feedback_service.triple_key(str(row["Head"]), str(row["Relation"]), str(row["Tail"]))
        if key in known_keys:
            return frame
        if not frame.empty and key in set(rows_to_keys(frame)):
            return frame
        frame = ensure_columns(frame, row)
        for col in frame.columns:
            row.setdefault(col, None)
        return pd.concat([frame, pd.DataFrame([row])], ignore_index=True)

    normalized_events: list[dict[str, Any]] = events.copy()
    for ref in legacy_refs:
        decision = str(ref.get("decision", "")).strip().lower()
        if decision not in {"accept", "reject", "uncertain", "correct"}:
            continue
        normalized_events.append(
            {
                "feedback_id": None,
                "candidate_id": ref.get("candidate_id"),
                "triple": {"Head": ref.get("Head"), "Relation": ref.get("Relation"), "Tail": ref.get("Tail")},
                "user": {
                    "decision": decision,
                    "reason": ref.get("reason"),
                    "comment": ref.get("comment"),
                    "corrected_triple": ref.get("corrected_triple"),
                },
                "effect": {},
            }
        )

    for event in normalized_events:
        triple = event.get("triple", {})
        user = event.get("user", {})
        h = str(triple.get("Head", "")).strip()
        rel = str(triple.get("Relation", "")).strip()
        t = str(triple.get("Tail", "")).strip()
        decision = str(user.get("decision", "")).strip().lower()
        if not (h and rel and t):
            continue
        if decision not in {"accept", "reject", "uncertain", "correct"}:
            continue
        row_key = feedback_service.triple_key(h, rel, t)
        feedback_id = event.get("feedback_id")
        candidate_id = event.get("candidate_id")

        additions = remove_key(additions, row_key)
        rejected = remove_key(rejected, row_key)
        unresolved = remove_key(unresolved, row_key)

        if decision == "accept":
            additions = append_row(
                additions,
                {
                    "Head": h,
                    "Relation": rel,
                    "Tail": t,
                    "decision": "accepted",
                    "provenance": "human_confirmed",
                    "feedback_id": feedback_id,
                    "candidate_id": candidate_id,
                },
            )
        elif decision == "reject":
            rejected = append_row(
                rejected,
                {
                    "Head": h,
                    "Relation": rel,
                    "Tail": t,
                    "decision": "rejected",
                    "provenance": "human_rejected",
                    "feedback_id": feedback_id,
                    "candidate_id": candidate_id,
                },
            )
        elif decision == "uncertain":
            unresolved = append_row(
                unresolved,
                {
                    "Head": h,
                    "Relation": rel,
                    "Tail": t,
                    "decision": "unresolved",
                    "provenance": "needs_expert_review",
                    "feedback_id": feedback_id,
                    "candidate_id": candidate_id,
                },
            )
        elif decision == "correct":
            corrected = user.get("corrected_triple") or {}
            rejected = append_row(
                rejected,
                {
                    "Head": h,
                    "Relation": rel,
                    "Tail": t,
                    "decision": "rejected",
                    "provenance": "replaced_by_user_correction",
                    "feedback_id": feedback_id,
                    "candidate_id": candidate_id,
                },
            )
            ch = str(corrected.get("Head", "")).strip()
            cr = str(corrected.get("Relation", "")).strip()
            ct = str(corrected.get("Tail", "")).strip()
            if ch and cr and ct:
                additions = append_row(
                    additions,
                    {
                        "Head": ch,
                        "Relation": cr,
                        "Tail": ct,
                        "decision": "accepted",
                        "provenance": "human_corrected",
                        "feedback_id": feedback_id,
                        "candidate_id": candidate_id,
                    },
                )

    return additions, rejected, unresolved


def record_demo_refinement(session: DemoSession, *, head: str, relation: str, tail: str, decision: str) -> None:
    choice = decision.strip().lower()
    if choice not in {"accept", "reject"}:
        raise ValueError("decision must be accept or reject")
    feedback_service.record_feedback(
        session,
        candidate_id=feedback_service.make_candidate_id(
            session.dataset_name,
            head.strip(),
            relation.strip(),
            tail.strip(),
        ),
        head=head.strip(),
        relation=relation.strip(),
        tail=tail.strip(),
        decision=choice,
    )
    log_event(
        session,
        "demo_refinement",
        "info",
        f"User {choice}ed a candidate triple in the interactive demo.",
        {"Head": head, "Relation": relation, "Tail": tail},
    )


def get_completed_payload(session: DemoSession) -> dict[str, Any]:
    llm_artifact = session.artifacts.get("llm")
    filtering_artifact = session.artifacts.get("filtering")

    if llm_artifact is not None and "decision" in llm_artifact["evaluated_df"].columns:
        additions_df = llm_artifact["evaluated_df"][llm_artifact["evaluated_df"]["decision"] == "accepted"].copy()
        keep_cols = [col for col in ["Head", "Relation", "Tail", "parsed_score", "decision", "candidate_id"] if col in additions_df.columns]
        additions_df = additions_df[keep_cols].copy()
        additions_df["provenance"] = "llm_accepted"
        rejected_df = llm_artifact["evaluated_df"][llm_artifact["evaluated_df"]["decision"] == "rejected"].copy()
        if "provenance" not in rejected_df.columns:
            rejected_df["provenance"] = "llm_rejected"
        unresolved_df = llm_artifact["evaluated_df"][llm_artifact["evaluated_df"]["decision"] == "unresolved"].copy()
        if "provenance" not in unresolved_df.columns:
            unresolved_df["provenance"] = "llm_unresolved"
    elif filtering_artifact is not None:
        additions_df = filtering_artifact["accepted_df"][["Head", "Relation", "Tail"]].copy()
        additions_df["provenance"] = "filter_accepted"
        rejected_df = filtering_artifact["rejected_df"].copy()
        if "provenance" not in rejected_df.columns:
            rejected_df["provenance"] = "filter_rejected"
        unresolved_df = filtering_artifact["accepted_df"].iloc[0:0].copy()
    else:
        additions_df = pd.DataFrame(columns=["Head", "Relation", "Tail"])
        rejected_df = pd.DataFrame(columns=["Head", "Relation", "Tail"])
        unresolved_df = pd.DataFrame(columns=["Head", "Relation", "Tail"])

    additions_df, rejected_df, unresolved_df = _apply_user_feedback(
        session,
        additions_df,
        rejected_df,
        unresolved_df,
    )

    completed_df = pd.concat(
        [session.known_df[["Head", "Relation", "Tail"]], additions_df[["Head", "Relation", "Tail"]]],
        ignore_index=True,
    ).drop_duplicates().reset_index(drop=True)
    recovered_mask = _missing_mask(additions_df, session.missing_df) if len(additions_df) else pd.Series(dtype=bool)
    feedback_events = list(session.artifacts.get("feedback_events", []))
    feedback_summary = feedback_service.build_feedback_summary(feedback_events)
    feedback_diagnostics = feedback_service.build_feedback_diagnostics(feedback_events)
    threshold_suggestion = feedback_service.calibrate_threshold_from_feedback(session)

    payload = {
        "summary": {
            "known_triples": int(len(session.known_df)),
            "reference_triples": int(len(session.pipeline_source_df)),
            "completed_triples": int(len(completed_df)),
            "accepted_additions": int(len(additions_df)),
            "rejected_candidates": int(len(rejected_df)),
            "unresolved_candidates": int(len(unresolved_df)),
            "recovered_true_missing": int(recovered_mask.sum()) if len(recovered_mask) else 0,
            "novel_not_in_reference": int(len(additions_df) - recovered_mask.sum()) if len(recovered_mask) else int(len(additions_df)),
            **feedback_summary,
            "feedback_total": len(feedback_events),
            "user_accepted": sum(1 for e in feedback_events if e.get("user", {}).get("decision") == "accept"),
            "user_rejected": sum(1 for e in feedback_events if e.get("user", {}).get("decision") == "reject"),
            "user_uncertain": sum(1 for e in feedback_events if e.get("user", {}).get("decision") == "uncertain"),
            "user_corrected": sum(1 for e in feedback_events if e.get("user", {}).get("decision") == "correct"),
            "agreement_rate": feedback_diagnostics.get("agreement_rate", 0.0),
        },
        "additions": _to_records(session, additions_df),
        "rejected": _to_records(session, rejected_df),
        "unresolved": _to_records(session, unresolved_df),
        "feedback_summary": feedback_summary,
        "feedback_diagnostics": feedback_diagnostics,
        "feedback_priors": session.artifacts.get("feedback_priors", {}),
        "feedback_cluster_stats": session.artifacts.get("feedback_cluster_stats", {}),
        "suggested_threshold": threshold_suggestion,
        "original_graph": {
            "triples": _to_records(session, session.known_df),
        },
        "completed_graph": {
            "triples": _to_records(session, completed_df),
        },
    }
    session.artifacts["completed"] = payload
    update_step(
        session,
        "completed_kg",
        status="completed",
        input_count=len(session.known_df),
        output_count=len(completed_df),
        explanation=(
            "Accepted candidates are merged back into the known KG so the audience can inspect the completed graph and its diff."
        ),
    )
    log_event(
        session,
        "completed_kg",
        "info",
        "Generated completed KG diff.",
        payload["summary"],
    )
    return payload


def export_diff_csv(session: DemoSession) -> str:
    payload = get_completed_payload(session)
    additions_df = pd.DataFrame(payload["additions"])
    if additions_df.empty:
        return "Head,Relation,Tail\n"
    return additions_df.to_csv(index=False)


def export_diff_json(session: DemoSession) -> str:
    payload = get_completed_payload(session)
    return json.dumps(payload["additions"], indent=2)


def _normalize_export_provenance(provenance: str | None) -> str:
    if not provenance:
        return "llm_validated"
    normalized = {
        "llm_accepted": "llm_validated",
        "filter_accepted": "llm_validated",
    }
    return normalized.get(provenance, provenance)


def export_completed_tsv(session: DemoSession) -> str:
    payload = get_completed_payload(session)
    rejected_keys = {
        feedback_service.triple_key(str(row["Head"]), str(row["Relation"]), str(row["Tail"]))
        for row in payload.get("rejected", [])
    }
    unresolved_keys = {
        feedback_service.triple_key(str(row["Head"]), str(row["Relation"]), str(row["Tail"]))
        for row in payload.get("unresolved", [])
    }

    rows: list[dict[str, str]] = []
    seen: set[str] = set()

    def append_if_new(head: str, relation: str, tail: str, provenance: str) -> None:
        key = feedback_service.triple_key(head, relation, tail)
        if key in rejected_keys or key in unresolved_keys:
            return
        if key in seen:
            return
        seen.add(key)
        rows.append({"head": head, "relation": relation, "tail": tail, "provenance": provenance})

    for record in payload.get("original_graph", {}).get("triples", []):
        append_if_new(str(record["Head"]), str(record["Relation"]), str(record["Tail"]), "original")

    for record in payload.get("additions", []):
        prov = _normalize_export_provenance(str(record.get("provenance") or "llm_validated"))
        append_if_new(str(record["Head"]), str(record["Relation"]), str(record["Tail"]), prov)

    lines = ["head\trelation\ttail\tprovenance"]
    for row in rows:
        lines.append(f"{row['head']}\t{row['relation']}\t{row['tail']}\t{row['provenance']}")
    return "\n".join(lines) + "\n"


def get_comparison_payload(
    session: DemoSession,
    *,
    format_name: str = "triples",
    strategy: str = "rag",
    top_k: int = DEFAULT_TOP_K,
    model_name: str = DEFAULT_MODEL_NAME,
    max_candidates: int = DEFAULT_LLM_LIMIT,
    force_mock: bool = False,
) -> dict[str, Any]:
    result_utils = _import_result_utils()
    prep_llm = _import_prep_llm()
    candidates_artifact = ensure_candidates(session)
    filtering_artifact = session.artifacts.get("filtering") or run_filtering(session)
    llm_artifact = session.artifacts.get("llm") or run_llm_validation(
        session,
        format_name=format_name,
        strategy=strategy,
        top_k=top_k,
        model_name=model_name,
        max_candidates=max_candidates,
        force_mock=force_mock,
    )

    baselines: list[dict[str, Any]] = []
    candidate_universe = candidates_artifact["filterable_df"][["Head", "Relation", "Tail"]].copy()
    candidate_truth = _missing_mask(candidate_universe, session.missing_df).astype(int).tolist()
    filter_only_df = filtering_artifact["accepted_df"][["Head", "Relation", "Tail"]].copy()
    filter_keys = set(_triple_key(filter_only_df))
    universe_keys = _triple_key(candidate_universe)
    filter_pred = [1 if key in filter_keys else 0 for key in universe_keys]
    filter_metrics = None
    if session.holdout_mode and len(candidate_universe):
        accuracy, f1_score, recall, precision = result_utils.compute_score(filter_pred, candidate_truth)
        filter_metrics = {
            "accuracy": accuracy,
            "precision": precision,
            "recall": recall,
            "f1": f1_score,
        }
    baselines.append(
        {
            "id": "filtering_only",
            "name": "Filtering Only",
            "status": "ready",
            "accepted_count": int(len(filter_only_df)),
            "metrics": filter_metrics,
            "notes": "Uses the real TransE thresholded output without LLM validation.",
        }
    )

    omnia_df = llm_artifact["evaluated_df"]
    accepted_omnia_df = (
        omnia_df[omnia_df["decision"] == "accepted"][["Head", "Relation", "Tail"]].copy()
        if "decision" in omnia_df.columns
        else omnia_df.iloc[0:0][["Head", "Relation", "Tail"]].copy()
    )
    omnia_keys = set(_triple_key(accepted_omnia_df))
    omnia_pred = [1 if key in omnia_keys else 0 for key in universe_keys]
    omnia_metrics = None
    if session.holdout_mode and len(candidate_universe):
        accuracy, f1_score, recall, precision = result_utils.compute_score(omnia_pred, candidate_truth)
        omnia_metrics = {
            "accuracy": accuracy,
            "precision": precision,
            "recall": recall,
            "f1": f1_score,
        }
    baselines.append(
        {
            "id": "omnia_full",
            "name": "OMNIA Full Pipeline",
            "status": "ready",
            "accepted_count": int((omnia_df["decision"] == "accepted").sum()) if "decision" in omnia_df.columns else 0,
            "metrics": omnia_metrics,
            "notes": "TransE filtering followed by LLM validation.",
        }
    )

    llm_only_source = candidates_artifact["filterable_df"].head(max_candidates).copy()
    if len(llm_only_source):
        ollama_info = ollama_status(model_name)
        llm_only_mock = force_mock or not (ollama_info["available"] and ollama_info["model_present"])
        llm_only_fallback = None
        try:
            llm_only = prep_llm.evaluate_candidates(
                llm_only_source,
                original_df=session.known_df if strategy == "context" else None,
                format_name=format_name,
                strategy=strategy,
                retriever=prep_llm.create_retriever(str(_ensure_known_csv(session)), top_k=top_k) if strategy == "rag" else None,
                top_k=top_k,
                model_name=model_name,
                mock=llm_only_mock,
            )
        except Exception as exc:
            llm_only_fallback = str(exc)
            llm_only_mock = True
            llm_only = prep_llm.evaluate_candidates(
                llm_only_source,
                original_df=session.known_df if strategy == "context" else None,
                format_name=format_name,
                strategy=strategy,
                retriever=prep_llm.create_retriever(str(_ensure_known_csv(session)), top_k=top_k) if strategy == "rag" else None,
                top_k=top_k,
                model_name=model_name,
                mock=True,
            )
        llm_only_truth = _missing_mask(llm_only[["Head", "Relation", "Tail"]], session.missing_df).astype(int).tolist()
        llm_only_pred = [1 if decision == "accepted" else 0 for decision in llm_only["decision"].tolist()]
        llm_only_metrics = None
        if session.holdout_mode:
            accuracy, f1_score, recall, precision = result_utils.compute_score(llm_only_pred, llm_only_truth)
            llm_only_metrics = {
                "accuracy": accuracy,
                "precision": precision,
                "recall": recall,
                "f1": f1_score,
            }
        baselines.append(
            {
                "id": "llm_only",
                "name": "LLM Only",
                "status": "ready",
                "accepted_count": int((llm_only["decision"] == "accepted").sum()),
                "metrics": llm_only_metrics,
                "notes": (
                    f"Evaluates the first {len(llm_only)} generated candidates without TransE filtering."
                    if not llm_only_fallback
                    else (
                        f"Evaluates the first {len(llm_only)} generated candidates without TransE filtering. "
                        f"Fell back to MOCK mode because the real LLM call failed: {llm_only_fallback}"
                    )
                ),
            }
        )
    else:
        baselines.append(
            {
                "id": "llm_only",
                "name": "LLM Only",
                "status": "disabled",
                "accepted_count": 0,
                "metrics": None,
                "notes": "No filterable candidates were available for LLM-only comparison.",
            }
        )

    return {"holdout_mode": session.holdout_mode, "baselines": baselines}


def run_full_pipeline(
    session: DemoSession,
    *,
    format_name: str = "triples",
    strategy: str = "rag",
    top_k: int = DEFAULT_TOP_K,
    model_name: str = DEFAULT_MODEL_NAME,
    max_candidates: int = DEFAULT_LLM_LIMIT,
    filtering_enabled: bool = True,
    preferred_device: str | None = "cuda",
    force_mock: bool = False,
) -> dict[str, Any]:
    ensure_candidates(session)
    run_filtering(session, enabled=filtering_enabled, preferred_device=preferred_device)
    run_llm_validation(
        session,
        format_name=format_name,
        strategy=strategy,
        top_k=top_k,
        model_name=model_name,
        max_candidates=max_candidates,
        force_mock=force_mock,
        use_filter_results=filtering_enabled,
    )
    completed = get_completed_payload(session)
    return {
        "steps": list(session.steps.values()),
        "summary": completed["summary"],
    }
