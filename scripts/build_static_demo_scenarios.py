#!/usr/bin/env python3
"""Build bounded static demo scenario JSON files for Vercel deployment."""

from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parents[1]
OUTPUT_DIR = REPO_ROOT / "frontend" / "public" / "demo-scenarios"

BENCHMARKS = [
    {
        "dataset_id": "codexM",
        "sample_id": "omnia_codex_m",
        "filename": "codexM_demo.json",
        "label": "CoDEx-M — OMNIA experiment sample",
        "short_name": "CoDEx-M",
        "source": "Wikidata / CoDEx benchmark",
        "source_note": "Prepared from a real CoDEx-M backend session slice (bounded overview + guided cluster).",
    },
    {
        "dataset_id": "fb15k237",
        "sample_id": "omnia_fb15k-237",
        "filename": "fb15k237_demo.json",
        "label": "FB15K-237",
        "short_name": "FB15K-237",
        "source": "Freebase subset benchmark",
        "source_note": "Prepared from a real FB15K-237 backend session slice.",
    },
    {
        "dataset_id": "wn18rr",
        "sample_id": "omnia_wn18rr",
        "filename": "wn18rr_demo.json",
        "label": "WN18RR",
        "short_name": "WN18RR",
        "source": "WordNet benchmark",
        "source_note": "Prepared from a real WN18RR backend session slice.",
    },
]


def _json_ready(obj: Any) -> Any:
    if isinstance(obj, dict):
        return {k: _json_ready(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_json_ready(v) for v in obj]
    if hasattr(obj, "item"):
        try:
            return obj.item()
        except Exception:
            pass
    if isinstance(obj, float) and (obj != obj):  # NaN
        return None
    return obj


def _filtering_meta(candidates: list[dict[str, Any]]) -> dict[str, Any]:
    rows = [
        c
        for c in candidates
        if c.get("distance") is not None
        and c.get("threshold") is not None
        and float(c["threshold"]) > 0
    ]
    available = len(rows) > 0
    kept = sum(1 for c in rows if float(c["distance"]) <= float(c["threshold"])) if available else 0
    threshold = float(rows[0]["threshold"]) if available else None
    return {
        "available": available,
        "model": "TransE (session)" if available else "TransE (unavailable in this scenario)",
        "threshold": threshold,
        "beforeFiltering": len(rows) if available else 0,
        "afterFiltering": kept if available else 0,
    }


def _llm_meta(explanation: dict[str, Any] | None, recommended_mode: str) -> dict[str, Any]:
    available = bool(explanation and explanation.get("llm_available"))
    return {
        "available": available,
        "strategy": "Backend RAG (session)" if available else "Backend RAG (unavailable in this scenario)",
        "topK": 3 if available else None,
        "promptMode": "Sentence-based RAG" if recommended_mode == "sentence-rag" else "Triple-based RAG",
    }


def _build_from_backend(entry: dict[str, str]) -> dict[str, Any] | None:
    from backend.app.services import ingestion, pipeline
    from backend.app.services.omnia_demo_slice import build_omnia_demo_slice, build_overview_slice

    sample_id = entry["sample_id"]
    try:
        session = ingestion.create_session_from_sample(sample_id, holdout_mode=True, sample_proportion=0.8)
    except Exception as exc:
        print(f"[skip] {entry['dataset_id']}: could not create session — {exc}")
        return None

    pipeline.ensure_candidates(session)
    overview = build_overview_slice(session, entry["dataset_id"], limit_nodes=80, limit_edges=120)
    guided = build_omnia_demo_slice(
        session,
        entry["dataset_id"],
        limit_nodes=100,
        limit_edges=200,
        mode="guided",
        expand_context=True,
    )

    if not guided.get("data_available"):
        print(f"[skip] {entry['dataset_id']}: guided slice empty")
        return None

    clusters = guided.get("clusters") or []
    candidates = guided.get("candidates") or []
    selected_cluster = guided.get("selected_cluster") or {}
    selected_candidate = guided.get("selected_candidate")
    cluster_id = str(selected_cluster.get("cluster_id") or "")

    generated = [
        c
        for c in candidates
        if cluster_id and cluster_id in (c.get("cluster_ids") or [])
    ]
    if not generated:
        generated = list(candidates)

    explanation = guided.get("explanation") or {}
    paper = ingestion.OMNIA_PAPER_COUNTS.get(sample_id, {})

    limitations = [
        "Static interactive scenario — not a live backend session.",
        "Sessions are not persisted; feedback is stored locally in the browser.",
    ]
    if not explanation.get("filtering_available"):
        limitations.append("TransE filtering artifacts were not stored for this scenario.")
    if not explanation.get("llm_available"):
        limitations.append("LLM/RAG validation artifacts were not stored for this scenario.")

    steps = {
        "kg": {"graphSlice": overview},
        "clustering": {"graphSlice": guided},
        "candidateGeneration": {"graphSlice": guided},
        "filtering": {"graphSlice": guided},
        "semanticValidation": {"graphSlice": guided},
        "feedback": {"graphSlice": guided},
        "completed": {"graphSlice": guided},
    }

    return {
        "datasetId": entry["dataset_id"],
        "label": entry["label"],
        "shortName": entry["short_name"],
        "source": entry["source"],
        "sourceNote": entry["source_note"],
        "description": f"Bounded OMNIA walkthrough for {entry['label']}.",
        "whyInteresting": "Shows the full OMNIA workflow on one coherent cluster-centred slice.",
        "recommendedMode": "sentence-rag" if entry["dataset_id"] == "codexM" else "triple-rag",
        "publicStatus": "public",
        "paperStats": {
            "entities": int(paper.get("entities", guided["stats"].get("nodes", 0))),
            "relations": int(paper.get("relations", 0)),
            "triples": int(paper.get("triples", guided["stats"].get("triples", 0))),
        },
        "overviewSlice": overview,
        "selectedCluster": selected_cluster,
        "selectedCandidate": selected_candidate,
        "generatedCandidates": generated,
        "clusters": clusters,
        "filtering": _filtering_meta(generated),
        "llm": _llm_meta(explanation, "sentence-rag" if entry["dataset_id"] == "codexM" else "triple-rag"),
        "limitations": limitations,
        "steps": steps,
        "defaultClusterId": cluster_id or None,
        "defaultCandidateId": (selected_candidate or {}).get("candidate_id") if selected_candidate else None,
    }


def _build_covid_static() -> dict[str, Any]:
    """COVID-Fact guided static scenario (no KG backend converter)."""
    nodes = [
        {"id": "remdesivir", "label": "remdesivir", "type": "entity", "role": "cluster_member"},
        {"id": "chloroquine", "label": "chloroquine", "type": "entity", "role": "cluster_member"},
        {"id": "sars-cov-2", "label": "sars-cov-2", "type": "entity", "role": "shared_tail"},
        {"id": "2019-ncov", "label": "2019-ncov", "type": "entity", "role": "context"},
        {"id": "fda", "label": "FDA", "type": "entity", "role": "context"},
        {"id": "hydroxychloroquine", "label": "hydroxychloroquine", "type": "entity", "role": "context"},
        {"id": "mers", "label": "MERS", "type": "entity", "role": "context"},
        {"id": "covid-19", "label": "COVID-19", "type": "entity", "role": "context"},
    ]
    edges = [
        {"id": "covid-e1|treats|known", "source": "remdesivir", "target": "sars-cov-2", "label": "treats", "status": "known", "provenance": "original"},
        {"id": "covid-e2|inhibits|known", "source": "remdesivir", "target": "2019-ncov", "label": "inhibits", "status": "known", "provenance": "original"},
        {"id": "covid-e3|inhibits|known", "source": "chloroquine", "target": "2019-ncov", "label": "inhibits", "status": "known", "provenance": "original"},
        {"id": "covid-e4|approves|known", "source": "fda", "target": "chloroquine", "label": "approves", "status": "known", "provenance": "original"},
        {"id": "covid-e5|approves|known", "source": "fda", "target": "hydroxychloroquine", "label": "approves", "status": "known", "provenance": "original"},
        {"id": "covid-e6|treats|candidate|cov-c1", "source": "chloroquine", "target": "sars-cov-2", "label": "treats", "status": "kept", "provenance": "cluster_generated", "candidate_id": "cov-c1", "distance": 0.42, "threshold": 0.70},
        {"id": "covid-e7|treats|candidate|cov-c2", "source": "remdesivir", "target": "2019-ncov", "label": "treats", "status": "kept", "provenance": "cluster_generated", "candidate_id": "cov-c2", "distance": 0.51, "threshold": 0.70},
        {"id": "covid-e8|affects|removed|cov-c3", "source": "chloroquine", "target": "mers", "label": "affects", "status": "removed", "provenance": "cluster_generated", "candidate_id": "cov-c3", "distance": 0.91, "threshold": 0.70},
    ]

    cluster = {
        "cluster_id": "C1",
        "shared_relation": "inhibits",
        "shared_tail": "2019-ncov",
        "members": ["remdesivir", "chloroquine"],
        "size": 2,
        "cluster_key": "(inhibits, 2019-ncov)",
    }

    candidates = [
        {
            "candidate_id": "cov-c1",
            "Head": "chloroquine",
            "Relation": "treats",
            "Tail": "sars-cov-2",
            "cluster_ids": ["C1"],
            "distance": 0.42,
            "threshold": 0.70,
            "filter_status": "kept",
            "llm_decision": "valid",
            "llm_score": 0.86,
            "llm_rationale": "Semantically supported by retrieved antiviral context.",
            "retrieved_context": ["(remdesivir, treats, sars-cov-2)", "(chloroquine, inhibits, 2019-ncov)"],
            "feedback_status": "none",
            "status_bucket": "kept",
            "why_generated": "Generated because chloroquine shares the inhibits→2019-ncov cluster pattern.",
        },
        {
            "candidate_id": "cov-c2",
            "Head": "remdesivir",
            "Relation": "treats",
            "Tail": "2019-ncov",
            "cluster_ids": ["C1"],
            "distance": 0.51,
            "threshold": 0.70,
            "filter_status": "kept",
            "llm_decision": "uncertain",
            "llm_score": 0.58,
            "llm_rationale": "Structurally plausible but weaker direct evidence.",
            "retrieved_context": ["(remdesivir, inhibits, 2019-ncov)"],
            "feedback_status": "none",
            "status_bucket": "kept",
        },
        {
            "candidate_id": "cov-c3",
            "Head": "chloroquine",
            "Relation": "affects",
            "Tail": "MERS",
            "cluster_ids": ["C1"],
            "distance": 0.91,
            "threshold": 0.70,
            "filter_status": "removed",
            "llm_decision": "invalid",
            "llm_score": 0.21,
            "llm_rationale": "No biomedical evidence in retrieved context.",
            "retrieved_context": ["(remdesivir, affects, MERS)"],
            "feedback_status": "none",
            "status_bucket": "removed",
        },
    ]

    base_slice = {
        "slice_id": "scenario:covid:C1",
        "mode": "guided",
        "label": "COVID-Fact guided static scenario",
        "source": "static_scenario",
        "data_available": True,
        "nodes": nodes,
        "edges": edges,
        "clusters": [cluster],
        "candidates": candidates,
        "selected_cluster": cluster,
        "selected_candidate": candidates[0],
        "stats": {"nodes": len(nodes), "edges": len(edges), "triples": 908, "candidates": len(candidates), "clusters": 1},
        "explanation": {
            "cluster_key": "(inhibits, 2019-ncov)",
            "generation_rule": "Hk x Pk",
            "filtering_available": True,
            "llm_available": True,
            "shared_relation": "inhibits",
            "shared_tail": "2019-ncov",
        },
        "warnings": ["COVID-Fact JSONL source exists but validated KG converter is pending."],
    }

    return {
        "datasetId": "covidFact",
        "label": "COVID-Fact",
        "shortName": "COVID-Fact",
        "source": "COVID-19 literature extraction",
        "sourceNote": "Static guided scenario only. JSONL source verified; KG converter pending.",
        "description": "Biomedical KG extracted from COVID-19 literature — static guided demo.",
        "whyInteresting": "Clear real-world missing triple example for conference demos.",
        "recommendedMode": "sentence-rag",
        "publicStatus": "public",
        "paperStats": {"entities": 1416, "relations": 28, "triples": 908},
        "overviewSlice": {**base_slice, "mode": "overview", "label": "COVID-Fact overview"},
        "selectedCluster": cluster,
        "selectedCandidate": candidates[0],
        "generatedCandidates": candidates,
        "clusters": [cluster],
        "filtering": _filtering_meta(candidates),
        "llm": _llm_meta(base_slice["explanation"], "sentence-rag"),
        "limitations": [
            "COVID-Fact JSONL is downloaded and verified; validated KG converter is pending.",
            "This scenario is static/guided only — not a live backend KG session.",
            "Feedback is stored locally in the browser.",
        ],
        "steps": {key: {"graphSlice": base_slice} for key in [
            "kg", "clustering", "candidateGeneration", "filtering",
            "semanticValidation", "feedback", "completed",
        ]},
        "defaultClusterId": "C1",
        "defaultCandidateId": "cov-c1",
    }


def _write_scenario(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    clean = _json_ready(payload)
    path.write_text(json.dumps(clean, indent=2), encoding="utf-8")
    overview = clean["overviewSlice"]
    guided = clean["steps"]["clustering"]["graphSlice"]
    print(
        f"  wrote {path.name}: overview {len(overview['nodes'])}n/{len(overview['edges'])}e, "
        f"guided {len(guided['nodes'])}n/{len(guided['edges'])}e"
    )


def main() -> int:
    sys.path.insert(0, str(REPO_ROOT))
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    print(f"Building static scenarios -> {OUTPUT_DIR}")

    for entry in BENCHMARKS:
        print(f"\n[{entry['dataset_id']}]")
        payload = _build_from_backend(entry)
        if payload is None:
            print("  using minimal fallback skipped - dataset unavailable")
            continue
        _write_scenario(OUTPUT_DIR / entry["filename"], payload)

    print("\n[covidFact]")
    _write_scenario(OUTPUT_DIR / "covidFact_static_demo.json", _build_covid_static())
    print("\nDone.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
