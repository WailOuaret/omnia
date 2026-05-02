from __future__ import annotations

from typing import Any

from pydantic import BaseModel
from fastapi import FastAPI, File, Form, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import PlainTextResponse

from .config import DEFAULT_LLM_LIMIT, DEFAULT_MODEL_NAME, DEFAULT_TOP_K
from .store import get_session
from .services import analytics, ingestion, pipeline


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
        return _session_summary(session)
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
        pipeline.record_demo_refinement(
            session,
            head=body.Head,
            relation=body.Relation,
            tail=body.Tail,
            decision=body.decision,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    total = len(session.artifacts.get("user_refinements", []))
    return {"status": "ok", "total_refinements": total}


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
    return analytics.build_cluster_payload(session)


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
def get_candidates(session_id: str):
    session = _session_or_404(session_id)
    return pipeline.get_candidates_payload(session)


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
        return pipeline.get_llm_payload(
            session,
            format_name=format_name,
            strategy=strategy,
            top_k=top_k,
            model_name=model_name,
            max_candidates=max_candidates,
            force_mock=force_mock,
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
        return pipeline.get_llm_comparison_payload(
            session,
            format_name=format_name,
            top_k=top_k,
            model_name=model_name,
            max_candidates=max_candidates,
            force_mock=force_mock,
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
        return pipeline.run_full_pipeline(
            session,
            format_name=format_name,
            strategy=strategy,
            top_k=top_k,
            model_name=model_name,
            max_candidates=max_candidates,
            filtering_enabled=filtering_enabled,
            preferred_device=preferred_device,
            force_mock=force_mock,
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
