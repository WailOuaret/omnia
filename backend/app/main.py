from __future__ import annotations

from typing import Any

from pydantic import BaseModel
from fastapi import FastAPI, File, Form, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import PlainTextResponse

from .config import DEFAULT_LLM_LIMIT, DEFAULT_MODEL_NAME, DEFAULT_TOP_K, DEMO_FAST_MODE
from .models import FeedbackBody
from .store import get_session
from .services import (
    analytics,
    feedback as feedback_service,
    graph_slice,
    ingestion,
    pipeline,
)
from .services.feedback import build_feedback_summary


app = FastAPI(
    title="OMNIA Demo API",
    version="0.1.0",
    description="System-demonstration backend for OMNIA knowledge graph completion.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _session_or_404(session_id: str):
    try:
        return get_session(session_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


def _session_summary(session) -> dict[str, Any]:
    return {
        "session_id": session.session_id,
        "dataset_name": session.dataset_name,
        "source_type": session.source_type,
        "holdout_mode": session.holdout_mode,
        "sample_proportion": session.sample_proportion,
        "diagnostics": session.diagnostics,
        "warnings": session.warnings,
        "steps": list(session.steps.values()),
        "created_at": session.created_at,
        "updated_at": session.updated_at,
    }


class DemoRefinementBody(BaseModel):
    Head: str
    Relation: str
    Tail: str
    decision: str


@app.get("/api/health")
def health():
    return {
        "status": "ok",
        "ollama": pipeline.ollama_status(DEFAULT_MODEL_NAME),
    }


@app.get("/api/samples")
def list_samples():
    return {"samples": ingestion.list_samples()}


@app.post("/api/datasets/preview")
async def preview_dataset(file: UploadFile = File(...)):
    try:
        df = await ingestion.read_upload(file)
        return ingestion.build_preview(df)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/api/sessions/upload")
async def create_session_from_upload(
    file: UploadFile = File(...),
    mapping_json: str | None = Form(default=None),
    holdout_mode: bool = Form(default=True),
    sample_proportion: float = Form(default=0.8),
    sampling_limit: int | None = Form(default=None),
):
    try:
        df = await ingestion.read_upload(file)
        mapping = None
        if mapping_json:
            import json

            mapping = json.loads(mapping_json)
        session = ingestion.create_session_from_dataframe(
            dataset_name=file.filename or "Uploaded KG",
            source_type="upload",
            source_path=file.filename,
            df=df,
            mapping=mapping,
            holdout_mode=holdout_mode,
            sample_proportion=sample_proportion,
            sampling_limit=sampling_limit,
        )
        return _session_summary(session)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/api/sessions/sample/{sample_id}")
def create_session_from_sample(
    sample_id: str,
    holdout_mode: bool = Query(default=True),
    sample_proportion: float = Query(default=0.8),
    sampling_limit: int | None = Query(default=None),
):
    try:
        session = ingestion.create_session_from_sample(
            sample_id=sample_id,
            holdout_mode=holdout_mode,
            sample_proportion=sample_proportion,
            sampling_limit=sampling_limit,
        )
        meta = graph_slice.session_overview(session)
        return {
            "session_id": session.session_id,
            "sample_id": session.artifacts.get("sample_id", sample_id),
            "dataset_name": session.dataset_name,
            "triple_count": meta["triple_count"],
            "entity_count": meta["entity_count"],
            "relation_count": meta["relation_count"],
            "url": f"/paper-demo?sessionId={session.session_id}",
            **_session_summary(session),
        }
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.get("/api/sessions/{session_id}")
def get_session_summary(session_id: str):
    return _session_summary(_session_or_404(session_id))


@app.get("/api/sessions/{session_id}/logs")
def get_logs(session_id: str):
    session = _session_or_404(session_id)
    return {"logs": session.logs}


@app.post("/api/sessions/{session_id}/demo/refinement")
def post_demo_refinement(session_id: str, body: DemoRefinementBody):
    session = _session_or_404(session_id)
    try:
        feedback_service.record_feedback(
            session,
            candidate_id=feedback_service.make_candidate_id(
                session.dataset_name,
                body.Head,
                body.Relation,
                body.Tail,
            ),
            head=body.Head,
            relation=body.Relation,
            tail=body.Tail,
            decision=body.decision,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    total = len(session.artifacts.get("user_refinements", []))
    return {"status": "ok", "total_refinements": total}


@app.post("/api/sessions/{session_id}/feedback")
def post_feedback(session_id: str, body: FeedbackBody):
    session = _session_or_404(session_id)
    try:
        event = feedback_service.record_feedback(
            session,
            candidate_id=body.candidate_id,
            head=body.Head,
            relation=body.Relation,
            tail=body.Tail,
            decision=body.decision,
            reason=body.reason,
            comment=body.comment,
            corrected_triple=body.corrected_triple.model_dump() if body.corrected_triple else None,
            user_confidence=body.user_confidence,
            evidence_judgement=body.evidence_judgement,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"status": "ok", "feedback": event}


@app.get("/api/sessions/{session_id}/feedback")
def get_feedback(session_id: str):
    session = _session_or_404(session_id)
    events = list(session.artifacts.get("feedback_events", []))
    return {
        "feedback": events,
        "summary": build_feedback_summary(events),
    }


@app.get("/api/sessions/{session_id}/overview")
def get_overview(session_id: str):
    session = _session_or_404(session_id)
    return analytics.build_overview_payload(session)


@app.get("/api/sessions/{session_id}/components/{component_id}")
def get_component_focus(
    session_id: str,
    component_id: str,
    graph_mode: str = Query(default="uploaded"),
):
    session = _session_or_404(session_id)
    try:
        return analytics.build_component_focus_payload(session, graph_mode=graph_mode, component_id=component_id)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.get("/api/sessions/{session_id}/clusters")
def get_clusters(session_id: str):
    session = _session_or_404(session_id)
    return graph_slice.list_clusters(session)


# ──────────────────────────────────────────────────────────────────────────────
# Dataset Navigator / Graph Slice Explorer endpoints
#
# These power the frontend `DatasetNavigatorPanel` and `usePaperDemoSession`
# hook. Each one reads the real session artifacts; nothing falls back to static
# demo data on the server side. If an artifact does not exist yet (e.g. the
# pipeline hasn't been run for that step) the endpoint returns a clear empty
# state with a warning so the frontend can show "Run this step first".
# ──────────────────────────────────────────────────────────────────────────────


@app.get("/api/sessions/{session_id}/overview/meta")
def get_session_meta(session_id: str):
    session = _session_or_404(session_id)
    return graph_slice.session_overview(session)


@app.get("/api/sessions/{session_id}/entities")
def list_session_entities(
    session_id: str,
    q: str = Query(default=""),
    limit: int = Query(default=20, ge=1, le=200),
):
    session = _session_or_404(session_id)
    items = graph_slice.list_entities(session, query=q, limit=limit)
    return {"entities": items, "source": "backend_session"}


@app.get("/api/sessions/{session_id}/relations")
def list_session_relations(
    session_id: str,
    q: str = Query(default=""),
    limit: int = Query(default=50, ge=1, le=500),
):
    session = _session_or_404(session_id)
    items = graph_slice.list_relations(session, query=q, limit=limit)
    return {"relations": items, "source": "backend_session"}


@app.get("/api/sessions/{session_id}/graph/slice")
def get_graph_slice_endpoint(
    session_id: str,
    mode: str = Query(default="guided"),
    entity: str | None = Query(default=None),
    relation: str | None = Query(default=None),
    cluster_id: str | None = Query(default=None),
    candidate_status: str | None = Query(default=None),
    feedback_bucket: str | None = Query(default=None),
    depth: int = Query(default=1, ge=1, le=2),
    limit_nodes: int = Query(default=80, ge=1, le=500),
    limit_edges: int = Query(default=150, ge=1, le=800),
):
    session = _session_or_404(session_id)
    return graph_slice.build_graph_slice(
        session,
        mode=mode,
        entity=entity,
        relation=relation,
        cluster_id=cluster_id,
        candidate_status=candidate_status,
        feedback_bucket=feedback_bucket,
        depth=depth,
        limit_nodes=limit_nodes,
        limit_edges=limit_edges,
    )


@app.get("/api/sessions/{session_id}/graph/neighborhood")
def get_graph_neighborhood(
    session_id: str,
    entity: str = Query(...),
    depth: int = Query(default=1, ge=1, le=2),
    limit: int = Query(default=100, ge=1, le=500),
):
    """Convenience wrapper around the slice endpoint for entity neighbourhoods."""
    session = _session_or_404(session_id)
    payload = graph_slice.build_graph_slice(
        session,
        mode="entity",
        entity=entity,
        depth=depth,
        limit_edges=limit,
        limit_nodes=limit,
    )
    return {
        "nodes": payload["nodes"],
        "edges": payload["edges"],
        "stats": {
            "nodes": payload["stats"]["nodes"],
            "edges": payload["stats"]["edges"],
        },
        "source": payload["source"],
    }


@app.get("/api/sessions/{session_id}/entities/{entity_id}/neighbors")
def get_entity_neighbors(
    session_id: str,
    entity_id: str,
    hops: int = Query(default=1, ge=1, le=2),
    limit: int = Query(default=50, ge=1, le=500),
):
    """Return a real session-backed neighborhood for graph expansion."""
    session = _session_or_404(session_id)
    payload = graph_slice.build_graph_slice(
        session,
        mode="entity",
        entity=entity_id,
        depth=hops,
        limit_edges=limit,
        limit_nodes=limit,
    )
    return {
        "entity_id": entity_id,
        "hops": hops,
        "nodes": payload["nodes"],
        "edges": payload["edges"],
        "stats": {
            "nodes_added": len(payload["nodes"]),
            "edges_added": len(payload["edges"]),
        },
        "source": payload["source"],
    }


@app.get("/api/sessions/{session_id}/candidates/detailed")
def get_session_candidates_detailed(
    session_id: str,
    cluster_id: str | None = Query(default=None),
    relation: str | None = Query(default=None),
    status: str | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
):
    """Backend-first candidate listing for the paper demo (real artifact rows)."""
    session = _session_or_404(session_id)
    pipeline.ensure_candidates(session)
    rows = graph_slice.list_candidates(
        session,
        cluster_id=cluster_id,
        relation=relation,
        status=status,
        limit=limit,
    )
    return {"candidates": rows, "source": "backend_session", "count": len(rows)}


@app.get("/api/sessions/{session_id}/clusters/detailed")
def get_session_clusters_detailed(session_id: str):
    """Backend-first cluster listing with feedback-augmented stats."""
    session = _session_or_404(session_id)
    rows = graph_slice.list_clusters(session)
    return {"clusters": rows, "source": "backend_session", "count": len(rows)}


class SliceRequest(BaseModel):
    mode: str
    entity: str | None = None
    relation: str | None = None
    cluster_id: str | None = None
    candidate_status: str | None = None
    llm_verdict: str | None = None
    feedback_bucket: str | None = None
    depth: int | None = 1
    limit_nodes: int | None = 80
    limit_edges: int | None = 150


@app.post("/api/sessions/{session_id}/demo/slice")
def post_demo_slice(session_id: str, body: SliceRequest):
    """Persist the selected slice on the session and return the bounded payload."""
    session = _session_or_404(session_id)
    payload = graph_slice.build_graph_slice(
        session,
        mode=body.mode,
        entity=body.entity,
        relation=body.relation,
        cluster_id=body.cluster_id,
        candidate_status=body.candidate_status,
        feedback_bucket=body.feedback_bucket,
        depth=body.depth or 1,
        limit_nodes=body.limit_nodes or 80,
        limit_edges=body.limit_edges or 150,
    )
    session.artifacts["selected_demo_slice"] = {
        "mode": body.mode,
        "entity": body.entity,
        "relation": body.relation,
        "cluster_id": body.cluster_id,
        "candidate_status": body.candidate_status,
        "feedback_bucket": body.feedback_bucket,
        "slice_id": payload["slice_id"],
    }
    return payload


@app.get("/api/sessions/{session_id}/clusters/{cluster_id}")
def get_cluster_focus(
    session_id: str,
    cluster_id: str,
    scope: str = Query(default="cluster"),
):
    session = _session_or_404(session_id)
    try:
        return analytics.build_cluster_focus_payload(session, cluster_id=cluster_id, scope=scope)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.get("/api/sessions/{session_id}/candidates")
def get_candidates(
    session_id: str,
    cluster_id: str | None = Query(default=None),
    relation: str | None = Query(default=None),
    status: str | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
):
    session = _session_or_404(session_id)
    pipeline.ensure_candidates(session)
    return graph_slice.list_candidates(
        session,
        cluster_id=cluster_id,
        relation=relation,
        status=status,
        limit=limit,
    )


@app.post("/api/sessions/{session_id}/filter")
def get_filtering(
    session_id: str,
    enabled: bool = Query(default=True),
    threshold: float | None = Query(default=None),
    preferred_device: str | None = Query(default="cuda"),
):
    session = _session_or_404(session_id)
    try:
        return pipeline.get_filter_payload(
            session,
            enabled=enabled,
            threshold=threshold,
            preferred_device=preferred_device,
        )
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/api/sessions/{session_id}/llm")
def get_llm_validation(
    session_id: str,
    format_name: str = Query(default="triples"),
    strategy: str = Query(default="rag"),
    top_k: int = Query(default=DEFAULT_TOP_K, ge=1, le=10),
    model_name: str = Query(default=DEFAULT_MODEL_NAME),
    max_candidates: int = Query(default=DEFAULT_LLM_LIMIT, ge=1, le=500),
    force_mock: bool = Query(default=False),
    use_filter_results: bool = Query(default=True),
):
    session = _session_or_404(session_id)
    try:
        effective_force_mock = bool(force_mock or DEMO_FAST_MODE)
        return pipeline.get_llm_payload(
            session,
            format_name=format_name,
            strategy=strategy,
            top_k=top_k,
            model_name=model_name,
            max_candidates=max_candidates,
            force_mock=effective_force_mock,
            use_filter_results=use_filter_results,
        )
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/api/sessions/{session_id}/llm/compare")
def get_llm_comparison(
    session_id: str,
    format_name: str = Query(default="triples"),
    top_k: int = Query(default=DEFAULT_TOP_K, ge=1, le=10),
    model_name: str = Query(default=DEFAULT_MODEL_NAME),
    max_candidates: int = Query(default=DEFAULT_LLM_LIMIT, ge=1, le=500),
    force_mock: bool = Query(default=False),
    use_filter_results: bool = Query(default=True),
):
    session = _session_or_404(session_id)
    try:
        effective_force_mock = bool(force_mock or DEMO_FAST_MODE)
        return pipeline.get_llm_comparison_payload(
            session,
            format_name=format_name,
            top_k=top_k,
            model_name=model_name,
            max_candidates=max_candidates,
            force_mock=effective_force_mock,
            use_filter_results=use_filter_results,
        )
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.get("/api/sessions/{session_id}/completed")
def get_completed(session_id: str):
    session = _session_or_404(session_id)
    return pipeline.get_completed_payload(session)


@app.get("/api/sessions/{session_id}/comparisons")
def get_comparisons(
    session_id: str,
    format_name: str = Query(default="triples"),
    strategy: str = Query(default="rag"),
    top_k: int = Query(default=DEFAULT_TOP_K, ge=1, le=10),
    model_name: str = Query(default=DEFAULT_MODEL_NAME),
    max_candidates: int = Query(default=DEFAULT_LLM_LIMIT, ge=1, le=500),
    force_mock: bool = Query(default=False),
):
    session = _session_or_404(session_id)
    return pipeline.get_comparison_payload(
        session,
        format_name=format_name,
        strategy=strategy,
        top_k=top_k,
        model_name=model_name,
        max_candidates=max_candidates,
        force_mock=force_mock,
    )


@app.post("/api/sessions/{session_id}/pipeline/run")
def run_pipeline(
    session_id: str,
    format_name: str = Query(default="triples"),
    strategy: str = Query(default="rag"),
    top_k: int = Query(default=DEFAULT_TOP_K, ge=1, le=10),
    model_name: str = Query(default=DEFAULT_MODEL_NAME),
    max_candidates: int = Query(default=DEFAULT_LLM_LIMIT, ge=1, le=500),
    filtering_enabled: bool = Query(default=True),
    preferred_device: str | None = Query(default="cuda"),
    force_mock: bool = Query(default=False),
):
    session = _session_or_404(session_id)
    try:
        effective_force_mock = bool(force_mock or DEMO_FAST_MODE)
        return pipeline.run_full_pipeline(
            session,
            format_name=format_name,
            strategy=strategy,
            top_k=top_k,
            model_name=model_name,
            max_candidates=max_candidates,
            filtering_enabled=filtering_enabled,
            preferred_device=preferred_device,
            force_mock=effective_force_mock,
        )
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.get("/api/sessions/{session_id}/export/diff.csv")
def export_diff_csv(session_id: str):
    session = _session_or_404(session_id)
    return PlainTextResponse(
        pipeline.export_diff_csv(session),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{session.dataset_name}_diff.csv"'},
    )


@app.get("/api/sessions/{session_id}/export/diff.json")
def export_diff_json(session_id: str):
    session = _session_or_404(session_id)
    return PlainTextResponse(
        pipeline.export_diff_json(session),
        media_type="application/json",
        headers={"Content-Disposition": f'attachment; filename="{session.dataset_name}_diff.json"'},
    )


@app.get("/api/sessions/{session_id}/export/diff")
def export_kg_diff(session_id: str):
    import json

    session = _session_or_404(session_id)
    payload = pipeline.get_completed_payload(session)
    diff = {
        "added": payload.get("additions", []),
        "rejected": payload.get("rejected", []),
        "unresolved": payload.get("unresolved", []),
    }
    return PlainTextResponse(
        json.dumps(diff, indent=2),
        media_type="application/json",
        headers={"Content-Disposition": f'attachment; filename="{session.dataset_name}_kg_diff.json"'},
    )


@app.get("/api/sessions/{session_id}/export/completed.tsv")
def export_completed_tsv(session_id: str):
    session = _session_or_404(session_id)
    return PlainTextResponse(
        pipeline.export_completed_tsv(session),
        media_type="text/tab-separated-values",
        headers={"Content-Disposition": f'attachment; filename="{session.dataset_name}_completed_kg.tsv"'},
    )


@app.post("/api/demo/create-paper-session")
def create_paper_demo_session(
    holdout_mode: bool = Query(default=True),
    sample_proportion: float = Query(default=0.8),
):
    """Create a ready-to-use backend session for the /paper-demo live feedback flow."""
    samples = ingestion.list_samples()
    if not samples:
        raise HTTPException(status_code=503, detail="No built-in samples available.")
    sample_id = samples[0]["id"]
    try:
        session = ingestion.create_session_from_sample(
            sample_id,
            holdout_mode=holdout_mode,
            sample_proportion=sample_proportion,
        )
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {
        "session_id": session.session_id,
        "sample_id": sample_id,
        "url": f"/paper-demo?sessionId={session.session_id}",
    }


@app.get("/api/sessions/{session_id}/export/feedback.json")
def export_feedback_json(session_id: str):
    session = _session_or_404(session_id)
    import json

    events = list(session.artifacts.get("feedback_events", []))
    return PlainTextResponse(
        json.dumps(events, indent=2),
        media_type="application/json",
        headers={"Content-Disposition": f'attachment; filename="{session.dataset_name}_feedback.json"'},
    )


@app.get("/api/sessions/{session_id}/export/feedback")
def export_feedback_default(session_id: str):
    return export_feedback_json(session_id)
