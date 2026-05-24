"""Build bounded graph slices from real session artifacts for the paper demo.

This service is the single source of truth for the `GET /api/sessions/{id}/graph/slice`
endpoint. It never falls back to static demo configs; it always reads the live
session artifacts so the frontend can render the actual KG being processed.

Outputs follow a shape that the frontend `DatasetNavigatorPanel` /
`PaperDemoStepView` can consume as-is, with explicit per-edge provenance:
- ``status="known"``           original KG triple
- ``status="candidate"``       proposed candidate, not yet filtered
- ``status="kept"`` / ``"removed"``   after structural filtering
- ``status="llm_valid"`` etc.  after LLM validation
- ``status="accepted"`` / ``"rejected"`` / ``"corrected"`` / ``"uncertain"``
  after human feedback (latest decision per candidate_id wins)
"""

from __future__ import annotations

from typing import Any, Iterable

import pandas as pd

from ..models import DemoSession


DEFAULT_NODE_LIMIT = 80
DEFAULT_EDGE_LIMIT = 150


def _node_dict(node_id: str, label: str | None = None, type_: str = "entity") -> dict[str, Any]:
    return {
        "id": node_id,
        "label": label or node_id,
        "type": type_,
        "source": "backend_session",
    }


def _edge_dict(
    head: str,
    relation: str,
    tail: str,
    *,
    status: str,
    provenance: str,
    candidate_id: str | None = None,
    extra: dict[str, Any] | None = None,
) -> dict[str, Any]:
    edge_id = f"{head}|{relation}|{tail}|{status}"
    payload = {
        "id": edge_id,
        "source": head,
        "target": tail,
        "label": relation,
        "status": status,
        "provenance": provenance,
        "candidate_id": candidate_id,
    }
    if extra:
        payload.update(extra)
    return payload


def _latest_feedback_by_candidate(session: DemoSession) -> dict[str, str]:
    """Return the latest decision per candidate_id from session feedback events."""
    events = session.artifacts.get("feedback_events") or []
    latest: dict[str, dict[str, Any]] = {}
    for ev in events:
        cid = ev.get("candidate_id") or ev.get("candidateId")
        if not cid:
            continue
        ts = ev.get("timestamp") or ""
        prev = latest.get(cid)
        if prev is None or ts >= (prev.get("timestamp") or ""):
            latest[cid] = ev
    return {
        cid: (ev.get("user") or {}).get("decision") or ""
        for cid, ev in latest.items()
    }


def _candidates_df(session: DemoSession) -> pd.DataFrame:
    """Pull the most informative candidate dataframe available."""
    llm = session.artifacts.get("llm")
    if llm is not None and isinstance(llm.get("evaluated_df"), pd.DataFrame):
        return llm["evaluated_df"].copy()
    filtering = session.artifacts.get("filtering")
    if filtering is not None and isinstance(filtering.get("scored_candidates_df"), pd.DataFrame):
        return filtering["scored_candidates_df"].copy()
    candidates_artifact = session.artifacts.get("candidates")
    if candidates_artifact is not None and isinstance(candidates_artifact.get("candidates_df"), pd.DataFrame):
        return candidates_artifact["candidates_df"].copy()
    return pd.DataFrame(columns=["Head", "Relation", "Tail"])


def _classify_candidate_status(row: pd.Series, feedback_by_cid: dict[str, str]) -> str:
    """Map a candidate row into one of our status buckets."""
    cid = str(row.get("candidate_id") or "")
    decision = feedback_by_cid.get(cid)
    if decision == "accept":
        return "accepted"
    if decision == "reject":
        return "rejected"
    if decision == "uncertain":
        return "uncertain"
    if decision == "correct":
        return "corrected"

    llm_decision = str(row.get("decision") or "").lower()
    if llm_decision == "accepted":
        return "llm_valid"
    if llm_decision == "rejected":
        return "llm_invalid"
    if llm_decision == "unresolved":
        return "llm_uncertain"

    filter_decision = str(row.get("filter_decision") or "").lower()
    if filter_decision == "rejected":
        return "removed"
    if filter_decision == "accepted":
        return "kept"

    raw_status = str(row.get("status") or "").lower()
    if "duplicate" in raw_status:
        return "known"
    return "candidate"


def _matches_filter(value: str, query: str | None) -> bool:
    if not query:
        return True
    return query.strip().lower() in (value or "").lower()


def list_entities(session: DemoSession, query: str = "", limit: int = 20) -> list[dict[str, Any]]:
    df = session.known_df
    if df is None or df.empty:
        return []
    heads = df["Head"].astype(str).tolist()
    tails = df["Tail"].astype(str).tolist()
    degree_by_entity: dict[str, int] = {}
    for node in heads + tails:
        degree_by_entity[node] = degree_by_entity.get(node, 0) + 1
    pool = sorted(degree_by_entity.keys())
    q = (query or "").strip().lower()
    if q:
        pool = [item for item in pool if q in item.lower()]
    return [
        {
            "id": item,
            "label": session.entity_labels.get(item, item),
            "degree": int(degree_by_entity.get(item, 0)),
        }
        for item in pool[:limit]
    ]


def list_relations(session: DemoSession, query: str = "", limit: int = 50) -> list[dict[str, Any]]:
    df = session.known_df
    if df is None or df.empty:
        return []
    rel_counts = df["Relation"].astype(str).value_counts().to_dict()
    pool = sorted(rel_counts.keys())
    q = (query or "").strip().lower()
    if q:
        pool = [item for item in pool if q in item.lower()]
    return [
        {
            "id": rel,
            "label": rel,
            "count": int(rel_counts.get(rel, 0)),
        }
        for rel in pool[:limit]
    ]


def list_clusters(session: DemoSession) -> list[dict[str, Any]]:
    """Return clusters from session artifacts, padded with feedback stats if available."""
    artifact = session.artifacts.get("clusters") or session.artifacts.get("relation_tail_clustering")
    cluster_rows: list[dict[str, Any]] = []

    # If clusters have not been computed yet, attempt a lightweight inline computation.
    if artifact is None:
        try:
            from candidates_generation import triple_gen  # type: ignore[import]

            raw_clusters = triple_gen.extract_relation_tail_clusters(session.known_df)
            # ``extract_relation_tail_clusters`` returns a list[dict]; normalise it.
            iterator: Iterable[dict[str, Any]] = (
                raw_clusters if isinstance(raw_clusters, list) else raw_clusters.to_dict("records")
            )
            for idx, row in enumerate(iterator):
                heads = list(row.get("heads") or row.get("members") or [])
                cluster_rows.append(
                    {
                        "cluster_id": row.get("cluster_id") or f"C{idx + 1}",
                        "shared_relation": str(row.get("relation") or row.get("shared_relation") or ""),
                        "shared_tail": str(row.get("tail") or row.get("shared_tail") or ""),
                        "members": heads,
                        "size": int(row.get("size") or len(heads)),
                    }
                )
        except Exception:  # noqa: BLE001 - keep robust to legacy sessions
            cluster_rows = []
    else:
        clusters = (
            artifact.get("clusters")
            if isinstance(artifact, dict)
            else None
        ) or []
        for cluster in clusters:
            cluster_rows.append(
                {
                    "cluster_id": cluster.get("cluster_id") or cluster.get("id") or "",
                    "shared_relation": cluster.get("relation") or cluster.get("shared_relation") or "",
                    "shared_tail": cluster.get("tail") or cluster.get("shared_tail") or "",
                    "members": list(cluster.get("heads") or cluster.get("members") or []),
                    "size": int(
                        cluster.get("size")
                        or len(cluster.get("heads") or cluster.get("members") or [])
                    ),
                }
            )

    stats = session.artifacts.get("feedback_cluster_stats") or {}
    for row in cluster_rows:
        cid = row["cluster_id"]
        if cid in stats:
            row["accept_rate"] = stats[cid].get("accept_rate")
            row["candidate_count"] = stats[cid].get("candidate_count")

    return cluster_rows


def list_candidates(
    session: DemoSession,
    *,
    cluster_id: str | None = None,
    relation: str | None = None,
    status: str | None = None,
    limit: int = 100,
) -> list[dict[str, Any]]:
    df = _candidates_df(session)
    if df.empty:
        return []
    filtering_artifact = session.artifacts.get("filtering") or {}
    fallback_threshold = filtering_artifact.get("threshold") if isinstance(filtering_artifact, dict) else None
    feedback_by_cid = _latest_feedback_by_candidate(session)
    rows: list[dict[str, Any]] = []
    for _, row in df.iterrows():
        bucket = _classify_candidate_status(row, feedback_by_cid)
        if status and status != "any" and status != bucket:
            continue
        if relation and relation.lower() not in str(row.get("Relation", "")).lower():
            continue
        cluster_ids = row.get("cluster_ids") or row.get("clusters") or []
        if cluster_id:
            if isinstance(cluster_ids, str):
                cluster_ids = [cluster_ids]
            if cluster_id not in (cluster_ids or []):
                continue
        filter_status = str(row.get("filter_decision") or "").lower()
        llm_decision_raw = str(row.get("decision") or "").lower()
        if llm_decision_raw == "accepted":
            llm_decision = "valid"
        elif llm_decision_raw == "rejected":
            llm_decision = "invalid"
        elif llm_decision_raw == "unresolved":
            llm_decision = "uncertain"
        else:
            llm_decision = "unknown"
        feedback_status_raw = feedback_by_cid.get(str(row.get("candidate_id") or ""))
        feedback_status = feedback_status_raw or "none"

        rows.append(
            {
                "candidate_id": str(row.get("candidate_id") or ""),
                "Head": str(row.get("Head") or ""),
                "Relation": str(row.get("Relation") or ""),
                "Tail": str(row.get("Tail") or ""),
                "cluster_ids": list(cluster_ids) if not isinstance(cluster_ids, list) else cluster_ids,
                "distance": float(row["distance"]) if "distance" in row and pd.notna(row.get("distance")) else None,
                "threshold": (
                    float(row["threshold"])
                    if "threshold" in row and pd.notna(row.get("threshold"))
                    else float(fallback_threshold)
                    if fallback_threshold is not None
                    else None
                ),
                "filter_status": filter_status or "unknown",
                "llm_decision": llm_decision,
                "llm_score": float(row["parsed_score"]) if "parsed_score" in row and pd.notna(row.get("parsed_score")) else None,
                "llm_rationale": str(row.get("rationale") or row.get("llm_reason") or ""),
                "retrieved_context": row.get("retrieved_context") or [],
                "feedback_status": feedback_status,
                "status_bucket": bucket,
                "provenance": {
                    "candidate": "cluster_generated",
                    "kept": "transe_kept",
                    "removed": "cluster_generated",
                    "llm_valid": "llm_valid",
                    "llm_invalid": "needs_expert_review",
                    "llm_uncertain": "needs_expert_review",
                    "accepted": "human_confirmed",
                    "rejected": "human_rejected",
                    "uncertain": "needs_expert_review",
                    "corrected": "human_corrected",
                }.get(bucket, "cluster_generated"),
            }
        )
        if len(rows) >= limit:
            break
    return rows


def build_graph_slice(
    session: DemoSession,
    *,
    mode: str = "guided",
    entity: str | None = None,
    relation: str | None = None,
    cluster_id: str | None = None,
    candidate_status: str | None = None,
    feedback_bucket: str | None = None,
    depth: int = 1,
    limit_nodes: int = DEFAULT_NODE_LIMIT,
    limit_edges: int = DEFAULT_EDGE_LIMIT,
) -> dict[str, Any]:
    """Construct a bounded slice from real backend session artifacts."""

    if session.known_df is None or session.known_df.empty:
        return {
            "slice_id": f"{session.session_id}:empty",
            "mode": mode,
            "label": "No backend triples available",
            "nodes": [],
            "edges": [],
            "clusters": [],
            "candidates": [],
            "stats": {"nodes": 0, "edges": 0, "triples": 0, "candidates": 0, "clusters": 0},
            "source": "backend_session",
            "data_available": False,
            "warnings": ["Session has no known triples."],
        }

    known_df = session.known_df.copy()
    candidates_df = _candidates_df(session)
    filtering_artifact = session.artifacts.get("filtering") or {}
    fallback_threshold = filtering_artifact.get("threshold") if isinstance(filtering_artifact, dict) else None
    feedback_by_cid = _latest_feedback_by_candidate(session)
    clusters = list_clusters(session)

    def _candidate_bucket(row: pd.Series) -> str:
        return _classify_candidate_status(row, feedback_by_cid)

    def _candidate_provenance(bucket: str) -> str:
        mapping = {
            "candidate": "cluster_generated",
            "kept": "transe_kept",
            "removed": "cluster_generated",
            "llm_valid": "llm_valid",
            "llm_invalid": "needs_expert_review",
            "llm_uncertain": "needs_expert_review",
            "accepted": "human_confirmed",
            "rejected": "human_rejected",
            "uncertain": "needs_expert_review",
            "corrected": "human_corrected",
        }
        return mapping.get(bucket, "cluster_generated")

    def _append_neighbourhood_nodes(seed_nodes: set[str], hop_depth: int) -> set[str]:
        frontier = set(seed_nodes)
        visited = set(seed_nodes)
        for _ in range(max(1, min(2, hop_depth))):
            next_nodes: set[str] = set()
            if not frontier:
                break
            mask = known_df["Head"].isin(frontier) | known_df["Tail"].isin(frontier)
            for _, known in known_df[mask].iterrows():
                next_nodes.add(str(known["Head"]))
                next_nodes.add(str(known["Tail"]))
            next_nodes -= visited
            visited |= next_nodes
            frontier = next_nodes
        return visited

    visible_nodes: set[str] = set()
    label = "Guided real slice"
    selected_candidate_rows: list[pd.Series] = []

    if mode == "entity" and entity:
        root = entity.strip()
        visible_nodes = _append_neighbourhood_nodes({root}, depth)
        label = f"Entity neighborhood: {root}"
    elif mode == "relation" and relation:
        rel_mask = known_df["Relation"].astype(str).str.contains(relation, case=False, na=False)
        for _, row in known_df[rel_mask].iterrows():
            visible_nodes.add(str(row["Head"]))
            visible_nodes.add(str(row["Tail"]))
        label = f"Relation slice: {relation}"
    elif mode == "cluster" and cluster_id:
        matching_cluster = next((c for c in clusters if c.get("cluster_id") == cluster_id), None)
        if matching_cluster:
            visible_nodes |= set(matching_cluster.get("members") or [])
            tail = str(matching_cluster.get("shared_tail") or "")
            if tail:
                visible_nodes.add(tail)
            label = f"Cluster {cluster_id}"
        if not candidates_df.empty:
            for _, row in candidates_df.iterrows():
                cids = row.get("cluster_ids") or row.get("clusters") or []
                if isinstance(cids, str):
                    cids = [cids]
                if cluster_id and cluster_id in cids:
                    selected_candidate_rows.append(row)
                    visible_nodes.add(str(row.get("Head") or ""))
                    visible_nodes.add(str(row.get("Tail") or ""))
    elif mode == "candidate":
        label = f"Candidate queue: {candidate_status or 'any'}"
        if not candidates_df.empty:
            for _, row in candidates_df.iterrows():
                bucket = _candidate_bucket(row)
                if candidate_status and candidate_status not in {"any", bucket}:
                    continue
                selected_candidate_rows.append(row)
            for row in selected_candidate_rows[: max(1, limit_edges // 2)]:
                visible_nodes.add(str(row.get("Head") or ""))
                visible_nodes.add(str(row.get("Tail") or ""))
        visible_nodes = _append_neighbourhood_nodes(visible_nodes, 1) if visible_nodes else visible_nodes
    elif mode == "feedback":
        label = f"Feedback bucket: {feedback_bucket or 'any'}"
        if not candidates_df.empty:
            for _, row in candidates_df.iterrows():
                cid = str(row.get("candidate_id") or "")
                decision = feedback_by_cid.get(cid)
                if feedback_bucket and feedback_bucket not in {"any", "reviewQueue"}:
                    if feedback_bucket == "accepted" and decision != "accept":
                        continue
                    if feedback_bucket == "rejected" and decision != "reject":
                        continue
                    if feedback_bucket == "uncertain" and decision != "uncertain":
                        continue
                    if feedback_bucket == "corrected" and decision != "correct":
                        continue
                if feedback_bucket == "reviewQueue" and decision not in {"uncertain"}:
                    continue
                if feedback_bucket and feedback_bucket == "any" and not decision:
                    continue
                selected_candidate_rows.append(row)
            for row in selected_candidate_rows[: max(1, limit_edges // 2)]:
                visible_nodes.add(str(row.get("Head") or ""))
                visible_nodes.add(str(row.get("Tail") or ""))
        visible_nodes = _append_neighbourhood_nodes(visible_nodes, 1) if visible_nodes else visible_nodes
    else:
        # guided mode: prioritize candidate-centric neighborhoods, then fill with known triples.
        label = "Guided real slice"
        if not candidates_df.empty:
            for _, row in candidates_df.iterrows():
                selected_candidate_rows.append(row)
                visible_nodes.add(str(row.get("Head") or ""))
                visible_nodes.add(str(row.get("Tail") or ""))
                if len(selected_candidate_rows) >= max(8, limit_edges // 4):
                    break
        visible_nodes = _append_neighbourhood_nodes(visible_nodes, 1) if visible_nodes else visible_nodes
        if not visible_nodes:
            for _, row in known_df.head(limit_edges).iterrows():
                visible_nodes.add(str(row["Head"]))
                visible_nodes.add(str(row["Tail"]))

    if len(visible_nodes) > limit_nodes:
        visible_nodes = set(sorted(visible_nodes)[:limit_nodes])

    edges: list[dict[str, Any]] = []
    for _, row in known_df.iterrows():
        head, rel, tail = str(row["Head"]), str(row["Relation"]), str(row["Tail"])
        if head in visible_nodes and tail in visible_nodes:
            edges.append(
                _edge_dict(
                    head,
                    rel,
                    tail,
                    status="known",
                    provenance="original",
                )
            )
            if len(edges) >= limit_edges:
                break

    if not candidates_df.empty and len(edges) < limit_edges:
        rows_to_scan: Iterable[pd.Series]
        if selected_candidate_rows:
            rows_to_scan = selected_candidate_rows
        else:
            rows_to_scan = [row for _, row in candidates_df.iterrows()]
        for row in rows_to_scan:
            head, rel, tail = str(row.get("Head") or ""), str(row.get("Relation") or ""), str(row.get("Tail") or "")
            if not head or not rel or not tail:
                continue
            if head not in visible_nodes or tail not in visible_nodes:
                continue
            bucket = _candidate_bucket(row)
            edges.append(
                _edge_dict(
                    head,
                    rel,
                    tail,
                    status=bucket,
                    provenance=_candidate_provenance(bucket),
                    candidate_id=str(row.get("candidate_id") or ""),
                    extra={
                        "distance": float(row["distance"]) if "distance" in row and pd.notna(row.get("distance")) else None,
                        "threshold": (
                            float(row["threshold"])
                            if "threshold" in row and pd.notna(row.get("threshold"))
                            else float(fallback_threshold)
                            if fallback_threshold is not None
                            else None
                        ),
                        "llm_score": float(row["parsed_score"]) if "parsed_score" in row and pd.notna(row.get("parsed_score")) else None,
                    },
                )
            )
            if len(edges) >= limit_edges:
                break

    # Deduplicate edges by id while preserving order.
    deduped_edges: list[dict[str, Any]] = []
    seen_edge_ids: set[str] = set()
    for edge in edges:
        if edge["id"] in seen_edge_ids:
            continue
        seen_edge_ids.add(edge["id"])
        deduped_edges.append(edge)
    edges = deduped_edges

    # Ensure node list includes all edge endpoints after edge truncation.
    node_ids_from_edges = set()
    for edge in edges:
        node_ids_from_edges.add(edge["source"])
        node_ids_from_edges.add(edge["target"])
    final_nodes = sorted(node_ids_from_edges if node_ids_from_edges else visible_nodes)
    if len(final_nodes) > limit_nodes:
        final_nodes = final_nodes[:limit_nodes]
    nodes = [_node_dict(n, session.entity_labels.get(n, n)) for n in final_nodes]

    filtered_candidates = list_candidates(
        session,
        cluster_id=cluster_id,
        relation=relation,
        status=candidate_status if mode == "candidate" else None,
        limit=100,
    )
    if mode == "feedback" and feedback_bucket and feedback_bucket != "any":
        if feedback_bucket == "reviewQueue":
            filtered_candidates = [c for c in filtered_candidates if c["feedback_status"] == "uncertain"]
        else:
            target = {
                "accepted": "accepted",
                "rejected": "rejected",
                "uncertain": "uncertain",
                "corrected": "corrected",
            }.get(feedback_bucket, feedback_bucket)
            filtered_candidates = [c for c in filtered_candidates if c["status_bucket"] == target or c["feedback_status"] == feedback_bucket]

    response_clusters = clusters
    if cluster_id:
        response_clusters = [c for c in clusters if c.get("cluster_id") == cluster_id]

    return {
        "slice_id": f"{session.session_id}:{mode}:{len(nodes)}n:{len(edges)}e",
        "mode": mode,
        "label": label,
        "nodes": nodes,
        "edges": edges,
        "clusters": response_clusters,
        "candidates": filtered_candidates,
        "stats": {
            "nodes": len(nodes),
            "edges": len(edges),
            "triples": int(len(known_df)),
            "candidates": int(len(filtered_candidates)),
            "clusters": int(len(response_clusters)),
        },
        "source": "backend_session",
        "data_available": bool(len(nodes) > 0 and len(edges) > 0),
    }


def session_overview(session: DemoSession) -> dict[str, Any]:
    """Lightweight metadata payload for `GET /api/sessions/{id}` extensions."""
    df = session.known_df
    triple_count = int(len(df)) if df is not None and not df.empty else 0
    entity_count = (
        int(pd.unique(pd.concat([df["Head"], df["Tail"]], ignore_index=True)).size)
        if triple_count
        else 0
    )
    relation_count = int(df["Relation"].nunique()) if triple_count else 0
    paper_counts = session.artifacts.get("paper_counts") or {}
    sample_id = session.artifacts.get("sample_id") or session.diagnostics.get("sample_id")
    return {
        "session_id": session.session_id,
        "dataset_name": session.dataset_name,
        "source_type": session.source_type,
        "sample_id": sample_id,
        "triple_count": int(paper_counts.get("triples", triple_count)),
        "entity_count": int(paper_counts.get("entities", entity_count)),
        "relation_count": int(paper_counts.get("relations", relation_count)),
        "artifact_keys": sorted(list(session.artifacts.keys())),
        "selected_slice": session.artifacts.get("selected_demo_slice"),
    }
