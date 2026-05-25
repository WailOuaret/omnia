"""OMNIA-specific demo slices built from real backend session artifacts."""

from __future__ import annotations

from typing import Any

import pandas as pd

from ..models import DemoSession
from . import pipeline


def _cluster_ids_for_row(row: pd.Series) -> list[str]:
    value = row.get("cluster_ids") or row.get("clusters") or []
    if isinstance(value, list):
        return [str(item) for item in value]
    if isinstance(value, tuple):
        return [str(item) for item in value]
    if isinstance(value, str) and value:
        return [value]
    return []


def _candidate_belongs_to_cluster(row: pd.Series, cluster_id: str) -> bool:
    cluster_ids = _cluster_ids_for_row(row)
    source = str(row.get("source_cluster") or "")
    if cluster_id in cluster_ids:
        return True
    return source == cluster_id


def _display_label(session: DemoSession, node_id: str) -> str:
    label = session.entity_labels.get(node_id)
    if label and label != node_id:
        return label
    if node_id.startswith("/m/"):
        return node_id[3:]
    if node_id.startswith("/") and "/" in node_id[1:]:
        parts = [part for part in node_id.split("/") if part]
        if parts:
            return parts[-1].replace("_", " ")
    return node_id


def _node(
    session: DemoSession,
    node_id: str,
    *,
    role: str = "context",
    cluster_id: str | None = None,
) -> dict[str, Any]:
    return {
        "id": node_id,
        "label": _display_label(session, node_id),
        "type": "entity",
        "source": "backend_session",
        "role": role,
        "cluster_id": cluster_id,
    }


def _edge(
    head: str,
    relation: str,
    tail: str,
    *,
    status: str,
    provenance: str,
    candidate_id: str | None = None,
    role: str = "context",
    extra: dict[str, Any] | None = None,
) -> dict[str, Any]:
    payload = {
        "id": f"{head}|{relation}|{tail}|{status}|{candidate_id or 'known'}",
        "source": head,
        "target": tail,
        "label": relation,
        "status": status,
        "provenance": provenance,
        "candidate_id": candidate_id,
        "role": role,
    }
    if extra:
        payload.update(extra)
    return payload


def _latest_feedback_by_candidate(session: DemoSession) -> dict[str, str]:
    events = session.artifacts.get("feedback_events") or []
    latest: dict[str, dict[str, Any]] = {}
    for event in events:
        candidate_id = event.get("candidate_id") or event.get("candidateId")
        if not candidate_id:
            continue
        timestamp = event.get("timestamp") or ""
        previous = latest.get(candidate_id)
        if previous is None or timestamp >= (previous.get("timestamp") or ""):
            latest[candidate_id] = event
    return {
        candidate_id: (event.get("user") or {}).get("decision") or ""
        for candidate_id, event in latest.items()
    }


def _classify_candidate(row: pd.Series, feedback_by_candidate: dict[str, str]) -> str:
    candidate_id = str(row.get("candidate_id") or "")
    feedback_decision = feedback_by_candidate.get(candidate_id)
    if feedback_decision == "accept":
        return "accepted"
    if feedback_decision == "reject":
        return "rejected"
    if feedback_decision == "uncertain":
        return "uncertain"
    if feedback_decision == "correct":
        return "corrected"

    llm_decision = str(row.get("decision") or "").lower()
    if llm_decision == "accepted":
        return "llm_valid"
    if llm_decision == "rejected":
        return "llm_invalid"
    if llm_decision == "unresolved":
        return "llm_uncertain"

    filter_decision = str(row.get("filter_decision") or "").lower()
    if filter_decision == "accepted":
        return "kept"
    if filter_decision == "rejected":
        return "removed"

    if bool(row.get("status_duplicate_existing")):
        return "known"
    return "candidate"


def _candidate_rows(session: DemoSession) -> pd.DataFrame:
    llm = session.artifacts.get("llm")
    if isinstance(llm, dict) and isinstance(llm.get("evaluated_df"), pd.DataFrame):
        return llm["evaluated_df"].copy()

    filtering = session.artifacts.get("filtering")
    if isinstance(filtering, dict) and isinstance(filtering.get("scored_candidates_df"), pd.DataFrame):
        return filtering["scored_candidates_df"].copy()

    artifact = pipeline.ensure_candidates(session)
    df = artifact.get("candidates_df")
    if isinstance(df, pd.DataFrame):
        return df.copy()
    return pd.DataFrame(columns=["Head", "Relation", "Tail"])


def _clusters(session: DemoSession) -> list[dict[str, Any]]:
    from candidates_generation import triple_gen

    artifact = session.artifacts.get("clusters") or session.artifacts.get("relation_tail_clustering")
    rows: list[dict[str, Any]] = []
    if isinstance(artifact, dict) and isinstance(artifact.get("clusters"), list):
        for index, cluster in enumerate(artifact["clusters"], start=1):
            members = list(cluster.get("heads") or cluster.get("members") or [])
            rows.append(
                {
                    "cluster_id": cluster.get("cluster_id") or cluster.get("id") or f"cluster-{index}",
                    "shared_relation": str(cluster.get("relation") or cluster.get("shared_relation") or ""),
                    "shared_tail": str(cluster.get("tail") or cluster.get("shared_tail") or ""),
                    "members": members,
                    "size": int(cluster.get("size") or len(members)),
                }
            )
    else:
        for cluster in triple_gen.extract_relation_tail_clusters(session.known_df):
            rows.append(
                {
                    "cluster_id": str(cluster["cluster_id"]),
                    "shared_relation": str(cluster["relation"]),
                    "shared_tail": str(cluster["tail"]),
                    "members": list(cluster["heads"]),
                    "size": int(cluster["size"]),
                }
            )
    return rows


def _candidate_counts(clusters: list[dict[str, Any]], candidates: pd.DataFrame) -> dict[str, int]:
    counts: dict[str, int] = {str(cluster["cluster_id"]): 0 for cluster in clusters}
    if candidates.empty:
        return counts
    for _, row in candidates.iterrows():
        if bool(row.get("status_duplicate_existing")):
            continue
        for cluster_id in _cluster_ids_for_row(row):
            if cluster_id in counts:
                counts[cluster_id] += 1
    return counts


def _artifact_score(row: pd.Series) -> int:
    score = 0
    if "distance" in row and pd.notna(row.get("distance")):
        score += 2
    if "filter_decision" in row and str(row.get("filter_decision") or ""):
        score += 2
    if str(row.get("decision") or "") or str(row.get("rationale") or ""):
        score += 3
    return score


def _select_cluster_and_candidate(
    clusters: list[dict[str, Any]],
    candidates: pd.DataFrame,
    *,
    requested_cluster_id: str | None,
    requested_candidate_id: str | None,
) -> tuple[dict[str, Any] | None, pd.Series | None]:
    if not clusters:
        return None, None

    counts = _candidate_counts(clusters, candidates)

    def cluster_score(cluster: dict[str, Any]) -> tuple[int, int, int, int]:
        size = int(cluster.get("size") or 0)
        candidate_count = counts.get(str(cluster["cluster_id"]), 0)
        return (
            1 if candidate_count > 0 else 0,
            1 if 3 <= size <= 12 else 0,
            -abs(size - 6),
            -int(cluster.get("_index") or 0),
        )

    enriched = [{**cluster, "candidate_count": counts.get(str(cluster["cluster_id"]), 0), "_index": idx} for idx, cluster in enumerate(clusters)]

    if requested_cluster_id:
        selected = next((cluster for cluster in enriched if cluster["cluster_id"] == requested_cluster_id), None)
    else:
        selected = max(enriched, key=cluster_score)

    if selected is None:
        return None, None

    cluster_id = str(selected["cluster_id"])
    cluster_rows: list[pd.Series] = []
    if not candidates.empty:
        for _, row in candidates.iterrows():
            if not _candidate_belongs_to_cluster(row, cluster_id):
                continue
            if bool(row.get("status_duplicate_existing")):
                continue
            cluster_rows.append(row)

    cluster_rows.sort(
        key=lambda row: (
            0 if str(row.get("candidate_id") or "") == requested_candidate_id else 1,
            -_artifact_score(row),
            str(row.get("candidate_id") or ""),
        )
    )

    selected_row = cluster_rows[0] if cluster_rows else None
    if requested_candidate_id and cluster_rows:
        explicit = next((row for row in cluster_rows if str(row.get("candidate_id") or "") == requested_candidate_id), None)
        if explicit is not None:
            selected_row = explicit
        elif requested_cluster_id:
            selected_row = None

    return selected, selected_row


def _candidate_dict(
    row: pd.Series,
    *,
    status: str,
    fallback_threshold: float | None,
    feedback_by_candidate: dict[str, str],
    focus_cluster_id: str | None = None,
) -> dict[str, Any]:
    llm_decision_raw = str(row.get("decision") or "").lower()
    llm_decision = ""
    if llm_decision_raw == "accepted":
        llm_decision = "valid"
    elif llm_decision_raw == "rejected":
        llm_decision = "invalid"
    elif llm_decision_raw == "unresolved":
        llm_decision = "uncertain"

    threshold = None
    if "threshold" in row and pd.notna(row.get("threshold")):
        threshold = float(row["threshold"])
    elif fallback_threshold is not None:
        threshold = float(fallback_threshold)

    candidate_id = str(row.get("candidate_id") or "")
    cluster_ids = _cluster_ids_for_row(row)
    if focus_cluster_id and focus_cluster_id in cluster_ids:
        cluster_ids = [focus_cluster_id, *[cid for cid in cluster_ids if cid != focus_cluster_id]]
    return {
        "candidate_id": candidate_id,
        "Head": str(row.get("Head") or ""),
        "Relation": str(row.get("Relation") or ""),
        "Tail": str(row.get("Tail") or ""),
        "cluster_ids": cluster_ids,
        "distance": float(row["distance"]) if "distance" in row and pd.notna(row.get("distance")) else None,
        "threshold": threshold,
        "filter_status": str(row.get("filter_decision") or "").lower(),
        "llm_decision": llm_decision,
        "llm_score": float(row["parsed_score"]) if "parsed_score" in row and pd.notna(row.get("parsed_score")) else None,
        "llm_rationale": str(row.get("rationale") or row.get("llm_reason") or ""),
        "retrieved_context": row.get("retrieved_context") or [],
        "feedback_status": feedback_by_candidate.get(candidate_id) or "none",
        "status_bucket": status,
        "already_known": status == "known" or bool(row.get("status_duplicate_existing")),
        "source_cluster": focus_cluster_id or (cluster_ids or [None])[0],
        "why_generated": (
            "Generated because this head belongs to the selected cluster and the relation-tail pair appears in the same cluster context."
        ),
    }


def _append_neighbours(
    known_df: pd.DataFrame,
    seed_nodes: set[str],
    *,
    hop_depth: int = 1,
    limit_nodes: int,
    node_roles: dict[str, str],
    edges: list[dict[str, Any]],
    limit_edges: int,
) -> set[str]:
    visited = set(seed_nodes)
    frontier = set(seed_nodes)
    seen_edge_ids: set[str] = {edge["id"] for edge in edges}
    for _ in range(max(1, hop_depth)):
        if not frontier or len(visited) >= limit_nodes or len(edges) >= limit_edges:
            break
        next_nodes: set[str] = set()
        mask = known_df["Head"].astype(str).isin(frontier) | known_df["Tail"].astype(str).isin(frontier)
        for _, row in known_df[mask].iterrows():
            head = str(row["Head"])
            tail = str(row["Tail"])
            relation = str(row["Relation"])
            touches_frontier = head in frontier or tail in frontier
            if not touches_frontier:
                continue
            for node_id in (head, tail):
                if node_id not in visited and len(visited) + len(next_nodes) < limit_nodes:
                    next_nodes.add(node_id)
                    node_roles.setdefault(node_id, "context")
            if len(edges) < limit_edges:
                edge = _edge(head, relation, tail, status="known", provenance="original", role="context")
                if edge["id"] not in seen_edge_ids:
                    edges.append(edge)
                    seen_edge_ids.add(edge["id"])
        visited |= next_nodes
        frontier = next_nodes
    return visited


def _saturate_known_edges(
    known_df: pd.DataFrame,
    node_ids: set[str],
    edges: list[dict[str, Any]],
    *,
    limit_edges: int,
) -> list[dict[str, Any]]:
    """Add any missing known triples between visible nodes (fixes disconnected context islands)."""
    seen_edge_ids: set[str] = {edge["id"] for edge in edges}
    for _, row in known_df.iterrows():
        if len(edges) >= limit_edges:
            break
        head = str(row["Head"])
        tail = str(row["Tail"])
        if head not in node_ids or tail not in node_ids:
            continue
        relation = str(row["Relation"])
        edge = _edge(head, relation, tail, status="known", provenance="original", role="context")
        if edge["id"] in seen_edge_ids:
            continue
        edges.append(edge)
        seen_edge_ids.add(edge["id"])
    return edges


def build_overview_slice(
    session: DemoSession,
    dataset_id: str,
    *,
    limit_nodes: int = 80,
    limit_edges: int = 120,
) -> dict[str, Any]:
    """Bounded KG overview for the first demo step (~60–100 nodes)."""
    known_df = session.known_df
    empty = {
        "slice_id": f"{session.session_id}:overview-empty",
        "mode": "overview",
        "label": "KG overview",
        "source": "backend_session",
        "dataset_id": dataset_id,
        "selected_cluster": None,
        "selected_candidate": None,
        "clusters": [],
        "candidates": [],
        "nodes": [],
        "edges": [],
        "stats": {"nodes": 0, "edges": 0, "triples": 0, "candidates": 0, "clusters": 0},
        "explanation": {"overview": True},
        "data_available": False,
        "warnings": [],
    }
    if known_df is None or known_df.empty:
        empty["warnings"] = ["Session has no known triples."]
        return empty

    degree: dict[str, int] = {}
    for _, row in known_df.iterrows():
        head = str(row["Head"])
        tail = str(row["Tail"])
        degree[head] = degree.get(head, 0) + 1
        degree[tail] = degree.get(tail, 0) + 1

    seed = max(degree, key=degree.get) if degree else str(known_df.iloc[0]["Head"])
    seed_nodes = {seed}
    node_roles: dict[str, str] = {seed: "anchor"}
    edges: list[dict[str, Any]] = []
    visited = _append_neighbours(
        known_df,
        seed_nodes,
        hop_depth=2,
        limit_nodes=limit_nodes,
        node_roles=node_roles,
        edges=edges,
        limit_edges=limit_edges,
    )

    node_ids = list(visited)[:limit_nodes]
    node_id_set = set(node_ids)
    edges = [edge for edge in edges if edge["source"] in node_id_set and edge["target"] in node_id_set]
    edges = _saturate_known_edges(known_df, node_id_set, edges, limit_edges=limit_edges)[:limit_edges]
    nodes = [_node(session, node_id, role=node_roles.get(node_id, "context")) for node_id in node_ids]

    return {
        "slice_id": f"{session.session_id}:overview",
        "mode": "overview",
        "label": f"KG overview ({len(nodes)} nodes)",
        "source": "backend_session",
        "dataset_id": dataset_id,
        "selected_cluster": None,
        "selected_candidate": None,
        "clusters": [],
        "candidates": [],
        "nodes": nodes,
        "edges": edges,
        "stats": {
            "nodes": len(nodes),
            "edges": len(edges),
            "triples": len(edges),
            "candidates": 0,
            "clusters": 0,
            "nodes_visible": len(nodes),
            "edges_visible": len(edges),
        },
        "explanation": {"overview": True, "anchor": seed},
        "data_available": len(nodes) > 0,
        "warnings": [],
    }


def build_omnia_demo_slice(
    session: DemoSession,
    dataset_id: str,
    limit_nodes: int = 100,
    limit_edges: int = 150,
    *,
    mode: str = "omnia_demo",
    cluster_id: str | None = None,
    candidate_id: str | None = None,
    candidate_status: str | None = None,
    feedback_bucket: str | None = None,
    expand_context: bool | None = None,
) -> dict[str, Any]:
    """Build one coherent OMNIA explanation slice from a real session."""

    if expand_context is None:
        expand_context = mode in {"guided", "omnia_demo", "omnia"}

    known_df = session.known_df
    empty_payload = {
        "slice_id": f"{session.session_id}:omnia-empty",
        "mode": mode,
        "label": "No backend triples available",
        "source": "backend_session",
        "dataset_id": dataset_id,
        "selected_cluster": None,
        "selected_candidate": None,
        "clusters": [],
        "candidates": [],
        "nodes": [],
        "edges": [],
        "stats": {
            "nodes": 0,
            "edges": 0,
            "triples": 0,
            "candidates": 0,
            "clusters": 0,
            "nodes_visible": 0,
            "edges_visible": 0,
            "cluster_members": 0,
            "generated_candidates": 0,
            "context_nodes": 0,
            "limits_applied": True,
        },
        "explanation": {
            "cluster_key": "(relation, tail)",
            "generation_rule": "Hk x Pk",
            "filtering_available": False,
            "llm_available": False,
        },
        "data_available": False,
        "warnings": [],
    }

    if known_df is None or known_df.empty:
        empty_payload["warnings"] = ["Session has no known triples."]
        return empty_payload

    pipeline.ensure_candidates(session)
    candidates_df = _candidate_rows(session)
    filtering_artifact = session.artifacts.get("filtering")
    fallback_threshold = (
        filtering_artifact.get("threshold")
        if isinstance(filtering_artifact, dict) and filtering_artifact.get("threshold") is not None
        else None
    )
    feedback_by_candidate = _latest_feedback_by_candidate(session)
    all_clusters = _clusters(session)
    selected_cluster, selected_candidate_row = _select_cluster_and_candidate(
        all_clusters,
        candidates_df,
        requested_cluster_id=cluster_id,
        requested_candidate_id=candidate_id,
    )

    if selected_cluster is None:
        payload = dict(empty_payload)
        payload["slice_id"] = f"{session.session_id}:omnia-no-cluster"
        payload["label"] = "No relation-tail clusters available"
        payload["stats"]["triples"] = int(len(known_df))
        payload["warnings"] = ["No cluster has at least two heads for the same relation-tail key."]
        return payload

    selected_cluster_id = str(selected_cluster["cluster_id"])
    members = [str(member) for member in selected_cluster.get("members") or []]
    shared_relation = str(selected_cluster.get("shared_relation") or "")
    shared_tail = str(selected_cluster.get("shared_tail") or "")

    cluster_candidate_rows: list[pd.Series] = []
    if not candidates_df.empty:
        for _, row in candidates_df.iterrows():
            if not _candidate_belongs_to_cluster(row, selected_cluster_id):
                continue
            status = _classify_candidate(row, feedback_by_candidate)
            if candidate_status and candidate_status not in {"any", status}:
                continue
            if feedback_bucket and feedback_bucket != "any":
                feedback_status = feedback_by_candidate.get(str(row.get("candidate_id") or ""))
                bucket_matches = {
                    "accepted": feedback_status == "accept" or status == "accepted",
                    "rejected": feedback_status == "reject" or status == "rejected",
                    "uncertain": feedback_status == "uncertain" or status == "uncertain",
                    "corrected": feedback_status == "correct" or status == "corrected",
                    "reviewQueue": feedback_status == "uncertain",
                }
                if not bucket_matches.get(feedback_bucket, False):
                    continue
            cluster_candidate_rows.append(row)

    cluster_candidate_rows = sorted(
        cluster_candidate_rows,
        key=lambda row: (
            0 if str(row.get("candidate_id") or "") == (candidate_id or "") else 1,
            -_artifact_score(row),
            str(row.get("candidate_id") or ""),
        ),
    )[:100]

    if selected_candidate_row is not None and not _candidate_belongs_to_cluster(selected_candidate_row, selected_cluster_id):
        selected_candidate_row = cluster_candidate_rows[0] if cluster_candidate_rows else None

    selected_candidate = (
        _candidate_dict(
            selected_candidate_row,
            status=_classify_candidate(selected_candidate_row, feedback_by_candidate),
            fallback_threshold=fallback_threshold,
            feedback_by_candidate=feedback_by_candidate,
            focus_cluster_id=selected_cluster_id,
        )
        if selected_candidate_row is not None
        else None
    )

    node_roles: dict[str, str] = {member: "cluster_member" for member in members}
    if shared_tail:
        node_roles[shared_tail] = "shared_tail"

    edges: list[dict[str, Any]] = []
    seed_nodes = set(members)
    if shared_tail:
        seed_nodes.add(shared_tail)

    member_df = known_df[known_df["Head"].astype(str).isin(members)].copy()
    key_mask = (
        (member_df["Relation"].astype(str) == shared_relation)
        & (member_df["Tail"].astype(str) == shared_tail)
    )
    priority_known = pd.concat(
        [member_df[key_mask], member_df[~key_mask].sort_values(["Relation", "Tail", "Head"])],
        ignore_index=True,
    ).drop_duplicates()

    for _, row in priority_known.iterrows():
        head = str(row["Head"])
        relation = str(row["Relation"])
        tail = str(row["Tail"])
        role = "cluster_key" if relation == shared_relation and tail == shared_tail else "cluster_context"
        node_roles.setdefault(head, "cluster_member" if head in members else "context")
        node_roles.setdefault(tail, "shared_tail" if tail == shared_tail else "context_tail")
        edges.append(_edge(head, relation, tail, status="known", provenance="original", role=role))
        seed_nodes.add(head)
        seed_nodes.add(tail)

    candidate_dicts: list[dict[str, Any]] = []
    for row in cluster_candidate_rows:
        status = _classify_candidate(row, feedback_by_candidate)
        candidate = _candidate_dict(
            row,
            status=status,
            fallback_threshold=fallback_threshold,
            feedback_by_candidate=feedback_by_candidate,
            focus_cluster_id=selected_cluster_id,
        )
        candidate_dicts.append(candidate)
        head = candidate["Head"]
        relation = candidate["Relation"]
        tail = candidate["Tail"]
        node_roles.setdefault(head, "cluster_member" if head in members else "candidate_head")
        node_roles.setdefault(tail, "shared_tail" if tail == shared_tail else "candidate_tail")
        seed_nodes.add(head)
        seed_nodes.add(tail)
        edges.append(
            _edge(
                head,
                relation,
                tail,
                status=status,
                provenance="cluster_generated",
                candidate_id=candidate["candidate_id"],
                role="generated_candidate",
                extra={
                    "distance": candidate["distance"],
                    "threshold": candidate["threshold"],
                    "llm_score": candidate["llm_score"],
                    "already_known": candidate["already_known"],
                    "cluster_id": selected_cluster_id,
                },
            )
        )

    core_node_count = len(seed_nodes)
    context_node_count = 0
    before = len(seed_nodes)
    seed_nodes = _append_neighbours(
        known_df,
        seed_nodes,
        hop_depth=2 if expand_context else 1,
        limit_nodes=limit_nodes,
        node_roles=node_roles,
        edges=edges,
        limit_edges=limit_edges,
    )
    context_node_count = max(0, len(seed_nodes) - before)

    seen_edges: set[str] = set()
    deduped_edges: list[dict[str, Any]] = []
    for edge in edges:
        if edge["id"] in seen_edges:
            continue
        seen_edges.add(edge["id"])
        deduped_edges.append(edge)
    edges = deduped_edges[:limit_edges]

    node_ids = [node_id for node_id in seed_nodes if node_id][:limit_nodes]
    for edge in edges:
        for node_id in [edge["source"], edge["target"]]:
            if node_id not in node_ids and len(node_ids) < limit_nodes:
                node_ids.append(node_id)
    node_ids = node_ids[:limit_nodes]
    node_id_set = set(node_ids)
    edges = [edge for edge in edges if edge["source"] in node_id_set and edge["target"] in node_id_set]
    edges = _saturate_known_edges(known_df, node_id_set, edges, limit_edges=limit_edges)[:limit_edges]

    nodes = [
        _node(session, node_id, role=node_roles.get(node_id, "context"), cluster_id=selected_cluster_id)
        for node_id in node_ids
    ]

    filtering_available = any(
        candidate.get("distance") is not None and candidate.get("threshold") is not None and candidate.get("threshold", 0) > 0
        for candidate in candidate_dicts
    )
    llm_available = any(
        candidate.get("llm_decision") or candidate.get("llm_score") is not None or candidate.get("llm_rationale")
        for candidate in candidate_dicts
    )

    candidate_count_by_cluster = _candidate_counts(all_clusters, candidates_df)
    cluster_payloads = []
    for cluster in all_clusters[:20]:
        cid = str(cluster["cluster_id"])
        cluster_payloads.append(
            {
                **cluster,
                "candidate_count": int(candidate_count_by_cluster.get(cid, 0)),
                "selected": cid == selected_cluster_id,
            }
        )

    selected_cluster_payload = {
        **selected_cluster,
        "cluster_key": f"({shared_relation}, {shared_tail})",
        "candidate_count": int(candidate_count_by_cluster.get(selected_cluster_id, 0)),
    }

    slice_label = (
        f"OMNIA bounded slice: {len(nodes)} nodes"
        if len(nodes) >= 80
        else f"Cluster-centred slice: {core_node_count} core nodes + {context_node_count} context"
    )

    return {
        "slice_id": f"{session.session_id}:omnia:{selected_cluster_id}:{len(nodes)}n:{len(edges)}e",
        "mode": "omnia_demo" if mode == "guided" else mode,
        "label": slice_label,
        "source": "backend_session",
        "dataset_id": dataset_id,
        "selected_cluster": selected_cluster_payload,
        "selected_candidate": selected_candidate,
        "clusters": cluster_payloads,
        "candidates": candidate_dicts[:100],
        "nodes": nodes,
        "edges": edges,
        "stats": {
            "nodes": len(nodes),
            "edges": len(edges),
            "triples": int(len(known_df)),
            "candidates": int(len(candidate_dicts[:100])),
            "clusters": int(len(cluster_payloads)),
            "nodes_visible": len(nodes),
            "edges_visible": len(edges),
            "cluster_members": len(members),
            "generated_candidates": len(candidate_dicts),
            "context_nodes": context_node_count,
            "limits_applied": len(nodes) >= limit_nodes or len(edges) >= limit_edges,
            "expand_context": expand_context,
        },
        "explanation": {
            "cluster_key": "(relation, tail)",
            "generation_rule": "Hk x Pk",
            "filtering_available": filtering_available,
            "llm_available": llm_available,
            "shared_relation": shared_relation,
            "shared_tail": shared_tail,
        },
        "data_available": bool(nodes and edges),
        "warnings": [],
    }
