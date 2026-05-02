from __future__ import annotations

import math
from collections import defaultdict
from typing import Any

import networkx as nx
import pandas as pd

from candidates_generation import triple_gen

from ..config import LARGE_DATASET_WARNING_THRESHOLD, MAX_GRAPH_TRIPLES
from ..models import DemoSession
from ..store import log_event, update_step


OVERVIEW_CACHE_KEY = "overview_graphs"
CLUSTER_CACHE_KEY = "cluster_focus"
SUMMARY_MODE_ENTITY_THRESHOLD = 34
SUMMARY_MODE_TRIPLE_THRESHOLD = 140
FOCUS_GRAPH_MAX_TRIPLES = 160
CLUSTER_GRAPH_MAX_TRIPLES = 120
NEIGHBORHOOD_GRAPH_MAX_TRIPLES = 150


def _trim_label_ascii(value: str, limit: int = 44) -> str:
    text = str(value).strip()
    if len(text) <= limit:
        return text
    if limit <= 3:
        return text[:limit]
    return f"{text[: limit - 3]}..."


def _trim_label(value: str, limit: int = 44) -> str:
    text = str(value).strip()
    if len(text) <= limit:
        return text
    return f"{text[: limit - 1]}…"


def _display_entity(session: DemoSession, value: str) -> str:
    return _trim_label_ascii(session.entity_labels.get(value, value))


def _display_relation(session: DemoSession, value: str) -> str:
    label = session.relation_labels.get(value)
    if label:
        return _trim_label_ascii(label)
    cleaned = value.replace("/", " ").replace("_", " ").replace(".", " ").strip()
    return _trim_label_ascii(cleaned or value)


def _frame_records(session: DemoSession, df: pd.DataFrame) -> list[dict[str, Any]]:
    if df.empty:
        return []
    clean_df = df.copy()
    for column in clean_df.columns:
        clean_df[column] = clean_df[column].apply(
            lambda value: value if not isinstance(value, pd.Timestamp) else value.isoformat()
        )
    if {"Head", "Relation", "Tail"}.issubset(clean_df.columns):
        clean_df["DisplayHead"] = clean_df["Head"].map(lambda value: _display_entity(session, str(value)))
        clean_df["DisplayRelation"] = clean_df["Relation"].map(lambda value: _display_relation(session, str(value)))
        clean_df["DisplayTail"] = clean_df["Tail"].map(lambda value: _display_entity(session, str(value)))
    return clean_df.to_dict("records")


def _simple_graph(df: pd.DataFrame) -> nx.Graph:
    graph = nx.Graph()
    for _, row in df.iterrows():
        graph.add_node(row["Head"])
        graph.add_node(row["Tail"])
        graph.add_edge(row["Head"], row["Tail"], relation=row["Relation"])
    return graph


def _edge_key(head: str, relation: str, tail: str) -> str:
    return f"{head}||{relation}||{tail}"


def _sorted_components(graph: nx.Graph) -> list[list[str]]:
    if not graph.number_of_nodes():
        return []
    components = [sorted(component) for component in nx.connected_components(graph)]
    return sorted(components, key=lambda component: (-len(component), component[0] if component else ""))


def _component_frame(df: pd.DataFrame, component_nodes: set[str]) -> pd.DataFrame:
    return df[df["Head"].isin(component_nodes) & df["Tail"].isin(component_nodes)].copy().reset_index(drop=True)


def compute_graph_stats(df: pd.DataFrame) -> dict[str, Any]:
    graph = _simple_graph(df)
    node_count = graph.number_of_nodes()
    edge_count = graph.number_of_edges()
    connected_components = _sorted_components(graph) if node_count else []
    isolated_nodes = list(nx.isolates(graph))
    density = nx.density(graph) if node_count > 1 else 0.0
    average_degree = sum(degree for _, degree in graph.degree()) / node_count if node_count else 0.0
    sparsity_score = min(1.0, max(0.0, 1 - density))
    relation_counts = df["Relation"].value_counts().rename_axis("relation").reset_index(name="count")
    return {
        "entity_count": int(node_count),
        "relation_count": int(df["Relation"].nunique()),
        "triple_count": int(len(df)),
        "average_degree": float(round(average_degree, 4)),
        "density": float(round(density, 6)),
        "connected_components": int(len(connected_components)),
        "isolated_nodes": isolated_nodes,
        "isolated_node_count": int(len(isolated_nodes)),
        "sparsity_score": float(round(sparsity_score, 6)),
        "relation_distribution": relation_counts.to_dict("records"),
        "component_sizes": [len(component) for component in connected_components],
    }


def _component_summary_graph(summaries: list[dict[str, Any]], total_triples: int) -> dict[str, Any]:
    nodes = [
        {
            "id": summary["component_id"],
            "label": summary["label"],
            "kind": "component",
            "degree": 0,
            "component_id": summary["component_id"],
            "is_isolated": summary["node_count"] <= 1,
            "highlighted": False,
            "node_count": summary["node_count"],
            "edge_count": summary["edge_count"],
            "relation_count": summary["relation_count"],
            "cluster_count": summary["cluster_count"],
            "sample_nodes": summary["sample_nodes"],
            "sample_relations": summary["sample_relations"],
            "warning": summary["warning"],
            "description": summary["description"],
        }
        for summary in summaries
    ]
    return {
        "nodes": nodes,
        "edges": [],
        "view": "summary",
        "aggregated": True,
        "truncated": False,
        "displayed_nodes": len(nodes),
        "total_nodes": len(nodes),
        "displayed_triples": len(nodes),
        "total_triples": total_triples,
        "warnings": [summary["warning"] for summary in summaries if summary.get("warning")],
    }


def _build_component_artifact(
    session: DemoSession,
    df: pd.DataFrame,
    *,
    cluster_rows: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    graph = _simple_graph(df)
    components = _sorted_components(graph)
    node_to_component: dict[str, str] = {}
    component_nodes: dict[str, set[str]] = {}
    component_frames: dict[str, pd.DataFrame] = {}

    for index, component in enumerate(components, start=1):
        component_id = f"component-{index}"
        component_set = set(component)
        component_nodes[component_id] = component_set
        component_frames[component_id] = _component_frame(df, component_set)
        for node in component:
            node_to_component[node] = component_id

    cluster_counts: dict[str, int] = defaultdict(int)
    if cluster_rows:
        for cluster in cluster_rows:
            involved_nodes = set(cluster["heads"]) | {cluster["tail"]}
            component_ids = {node_to_component[node] for node in involved_nodes if node in node_to_component}
            for component_id in component_ids:
                cluster_counts[component_id] += 1

    summaries: list[dict[str, Any]] = []
    for index, component in enumerate(components, start=1):
        component_id = f"component-{index}"
        component_set = component_nodes[component_id]
        component_df = component_frames[component_id]
        component_graph = graph.subgraph(component_set).copy()
        density = nx.density(component_graph) if len(component_set) > 1 else 0.0
        sparsity_score = min(1.0, max(0.0, 1 - density))
        isolated_nodes = sorted(nx.isolates(component_graph))
        warning = None
        if len(component_set) <= 3 or len(component_df) <= 3:
            warning = "Sparse/disconnected region: limited structural evidence."

        summaries.append(
            {
                "component_id": component_id,
                "label": f"Component {index}",
                "node_count": int(len(component_set)),
                "edge_count": int(len(component_df)),
                "relation_count": int(component_df["Relation"].nunique()) if len(component_df) else 0,
                "cluster_count": int(cluster_counts.get(component_id, 0)),
                "isolated_node_count": int(len(isolated_nodes)),
                "density": float(round(density, 6)),
                "sparsity_score": float(round(sparsity_score, 6)),
                "sample_nodes": [_display_entity(session, node) for node in sorted(component)[:4]],
                "sample_relations": [
                    _display_relation(session, relation)
                    for relation in sorted(component_df["Relation"].drop_duplicates().tolist())[:4]
                ],
                "warning": warning,
                "warnings": [warning] if warning else [],
                "anchor_node": sorted(component)[0] if component else None,
                "description": (
                    f"{len(component_set)} nodes, {len(component_df)} triples, "
                    f"{cluster_counts.get(component_id, 0)} relation-tail clusters."
                ),
            }
        )

    return {
        "graph": graph,
        "components": summaries,
        "component_nodes": component_nodes,
        "component_frames": component_frames,
        "node_to_component": node_to_component,
        "summary_graph": _component_summary_graph(summaries, len(df)),
    }


def _build_entity_graph_payload(
    session: DemoSession,
    df: pd.DataFrame,
    *,
    view: str,
    max_triples: int,
    warnings: list[str] | None = None,
    highlighted_nodes: set[str] | None = None,
    highlighted_edges: set[str] | None = None,
) -> dict[str, Any]:
    highlighted_nodes = highlighted_nodes or set()
    highlighted_edges = highlighted_edges or set()
    total_nodes = int(pd.unique(pd.concat([df["Head"], df["Tail"]])).size) if len(df) else 0
    total_triples = int(len(df))
    truncated = len(df) > max_triples
    graph_df = (
        df.sample(max_triples, random_state=42).sort_values(["Head", "Relation", "Tail"]).reset_index(drop=True)
        if truncated
        else df.copy().reset_index(drop=True)
    )
    graph = _simple_graph(graph_df)
    components = _sorted_components(graph)
    node_to_component: dict[str, str] = {}
    for index, component in enumerate(components, start=1):
        component_id = f"component-{index}"
        for node in component:
            node_to_component[node] = component_id

    relation_counts_by_node: dict[str, set[str]] = defaultdict(set)
    for _, row in graph_df.iterrows():
        relation_counts_by_node[row["Head"]].add(row["Relation"])
        relation_counts_by_node[row["Tail"]].add(row["Relation"])

    nodes: list[dict[str, Any]] = []
    for node in sorted(graph.nodes()):
        nodes.append(
            {
                "id": node,
                "label": _display_entity(session, node),
                "kind": "entity",
                "degree": int(graph.degree(node)),
                "component_id": node_to_component.get(node),
                "is_isolated": graph.degree(node) == 0,
                "highlighted": node in highlighted_nodes,
                "node_count": 1,
                "edge_count": int(graph.degree(node)),
                "relation_count": len(relation_counts_by_node.get(node, set())),
                "cluster_count": None,
                "sample_nodes": [],
                "sample_relations": [
                    _display_relation(session, relation)
                    for relation in sorted(relation_counts_by_node.get(node, set()))[:4]
                ],
                "warning": None,
                "description": None,
            }
        )

    edges: list[dict[str, Any]] = []
    for edge_index, (_, row) in enumerate(graph_df.iterrows()):
        key = _edge_key(row["Head"], row["Relation"], row["Tail"])
        edges.append(
            {
                "id": f"edge-{edge_index}",
                "source": row["Head"],
                "target": row["Tail"],
                "label": _display_relation(session, row["Relation"]),
                "highlighted": key in highlighted_edges,
            }
        )

    return {
        "nodes": nodes,
        "edges": edges,
        "view": view,
        "aggregated": False,
        "truncated": truncated,
        "displayed_nodes": int(graph.number_of_nodes()),
        "total_nodes": total_nodes,
        "displayed_triples": int(len(graph_df)),
        "total_triples": total_triples,
        "warnings": warnings or [],
    }


def _prepare_overview_artifact(session: DemoSession) -> dict[str, Any]:
    if OVERVIEW_CACHE_KEY in session.artifacts:
        return session.artifacts[OVERVIEW_CACHE_KEY]

    known_clusters = triple_gen.extract_relation_tail_clusters(session.known_df)
    artifact = {
        "uploaded": _build_component_artifact(session, session.uploaded_df),
        "known": _build_component_artifact(session, session.known_df, cluster_rows=known_clusters),
        "known_clusters": known_clusters,
    }
    session.artifacts[OVERVIEW_CACHE_KEY] = artifact
    return artifact


def _overview_policy(stats: dict[str, Any]) -> dict[str, Any]:
    large_dataset_mode = (
        stats["entity_count"] >= SUMMARY_MODE_ENTITY_THRESHOLD
        or stats["triple_count"] >= SUMMARY_MODE_TRIPLE_THRESHOLD
    )
    return {
        "default_level": "summary" if large_dataset_mode else "component",
        "large_dataset_mode": large_dataset_mode,
        "lazy_components": True,
        "summary_first_reason": (
            "Large dataset detected: start in component-summary mode and open focused subgraphs on demand."
            if large_dataset_mode
            else "Dataset is compact enough for immediate component focus."
        ),
    }


def build_overview_payload(session: DemoSession) -> dict[str, Any]:
    overview_artifact = _prepare_overview_artifact(session)
    uploaded_stats = compute_graph_stats(session.uploaded_df)
    known_stats = compute_graph_stats(session.known_df)

    update_step(
        session,
        "sparsity_analysis",
        status="completed",
        input_count=len(session.uploaded_df),
        output_count=uploaded_stats["connected_components"],
        explanation="The graph was analyzed for connectivity, density, isolated nodes, and sparse regions.",
    )
    log_event(
        session,
        "sparsity_analysis",
        "info",
        "Computed graph statistics for uploaded and pipeline graphs.",
        {
            "uploaded_density": uploaded_stats["density"],
            "known_density": known_stats["density"],
            "isolated_nodes": uploaded_stats["isolated_node_count"],
            "component_count": uploaded_stats["connected_components"],
        },
    )

    return {
        "uploaded_stats": uploaded_stats,
        "known_stats": known_stats,
        "uploaded_summary_graph": overview_artifact["uploaded"]["summary_graph"],
        "known_summary_graph": overview_artifact["known"]["summary_graph"],
        "uploaded_components": overview_artifact["uploaded"]["components"],
        "known_components": overview_artifact["known"]["components"],
        "graph_policy": {
            "uploaded": _overview_policy(uploaded_stats),
            "known": _overview_policy(known_stats),
        },
        "warnings": session.warnings,
    }


def build_component_focus_payload(session: DemoSession, graph_mode: str, component_id: str) -> dict[str, Any]:
    overview_artifact = _prepare_overview_artifact(session)
    if graph_mode not in {"uploaded", "known"}:
        raise KeyError(f"Unsupported graph mode: {graph_mode}")

    artifact = overview_artifact[graph_mode]
    if component_id not in artifact["component_nodes"]:
        raise KeyError(f"Unknown component: {component_id}")

    summary = next(item for item in artifact["components"] if item["component_id"] == component_id)
    component_df = artifact["component_frames"][component_id]
    graph_payload = _build_entity_graph_payload(
        session,
        component_df,
        view="component",
        max_triples=FOCUS_GRAPH_MAX_TRIPLES,
        warnings=summary["warnings"],
    )
    return {
        "component": summary,
        "graph": graph_payload,
    }


def _prepare_cluster_artifact(session: DemoSession) -> dict[str, Any]:
    if CLUSTER_CACHE_KEY in session.artifacts:
        return session.artifacts[CLUSTER_CACHE_KEY]

    overview_artifact = _prepare_overview_artifact(session)
    component_lookup = overview_artifact["known"]["node_to_component"]
    component_summaries = {
        item["component_id"]: item for item in overview_artifact["known"]["components"]
    }

    cluster_rows = triple_gen.extract_relation_tail_clusters(session.known_df)
    public_rows: list[dict[str, Any]] = []
    cluster_map: dict[str, dict[str, Any]] = {}

    for cluster in cluster_rows:
        shared_df = session.known_df[
            (session.known_df["Relation"] == cluster["relation"])
            & (session.known_df["Tail"] == cluster["tail"])
            & (session.known_df["Head"].isin(cluster["heads"]))
        ].sort_values(["Head", "Relation", "Tail"]).reset_index(drop=True)
        source_df = session.known_df[
            session.known_df["Head"].isin(cluster["heads"])
        ].sort_values(["Head", "Relation", "Tail"]).reset_index(drop=True)
        involved_nodes = set(cluster["heads"]) | {cluster["tail"]}
        component_ids = sorted({component_lookup[node] for node in involved_nodes if node in component_lookup})
        component_id = component_ids[0] if component_ids else None
        component_summary = component_summaries.get(component_id)

        public_row = {
            "cluster_id": cluster["cluster_id"],
            "cluster_key": cluster["cluster_key"],
            "cluster_key_display": f"{_display_relation(session, cluster['relation'])} -> {_display_entity(session, cluster['tail'])}",
            "relation": cluster["relation"],
            "display_relation": _display_relation(session, cluster["relation"]),
            "tail": cluster["tail"],
            "display_tail": _display_entity(session, cluster["tail"]),
            "heads": cluster["heads"],
            "display_heads": [_display_entity(session, head) for head in cluster["heads"]],
            "size": cluster["size"],
            "warning": cluster["warning"],
            "component_id": component_id,
            "component_label": component_summary["label"] if component_summary else None,
            "source_triple_count": int(len(shared_df)),
            "member_triple_count": int(len(source_df)),
        }
        public_rows.append(public_row)
        cluster_map[cluster["cluster_id"]] = {
            **public_row,
            "shared_df": shared_df,
            "source_df": source_df,
            "relation_tail_pairs": [
                {
                    "Relation": row["Relation"],
                    "Tail": row["Tail"],
                    "DisplayRelation": _display_relation(session, row["Relation"]),
                    "DisplayTail": _display_entity(session, row["Tail"]),
                }
                for _, row in source_df[["Relation", "Tail"]].drop_duplicates().iterrows()
            ],
            "component_summary": component_summary,
        }

    weak_count = sum(1 for row in public_rows if row["size"] <= 2)
    warnings = []
    if weak_count:
        warnings.append("Sparse graphs create smaller clusters and weaker propagation signals.")

    artifact = {
        "summary": {
            "cluster_count": len(public_rows),
            "weak_cluster_count": weak_count,
            "max_cluster_size": max((row["size"] for row in public_rows), default=0),
        },
        "clusters": public_rows,
        "cluster_map": cluster_map,
        "warnings": warnings,
    }
    session.artifacts[CLUSTER_CACHE_KEY] = artifact
    return artifact


def build_cluster_payload(session: DemoSession) -> dict[str, Any]:
    artifact = _prepare_cluster_artifact(session)
    update_step(
        session,
        "relation_tail_clustering",
        status="completed",
        input_count=len(session.known_df),
        output_count=len(artifact["clusters"]),
        explanation=(
            "OMNIA groups heads that share a (Relation, Tail) pair and exposes focused subgraphs instead of rendering the entire KG."
        ),
    )
    log_event(
        session,
        "relation_tail_clustering",
        "info",
        "Built relation-tail clusters from the known KG.",
        {
            "cluster_count": artifact["summary"]["cluster_count"],
            "weak_cluster_count": artifact["summary"]["weak_cluster_count"],
        },
    )
    return {
        "summary": artifact["summary"],
        "clusters": artifact["clusters"],
        "warnings": artifact["warnings"],
    }


def build_cluster_focus_payload(session: DemoSession, cluster_id: str, scope: str = "cluster") -> dict[str, Any]:
    cluster_artifact = _prepare_cluster_artifact(session)
    if cluster_id not in cluster_artifact["cluster_map"]:
        raise KeyError(f"Unknown cluster: {cluster_id}")

    cluster = cluster_artifact["cluster_map"][cluster_id]
    overview_artifact = _prepare_overview_artifact(session)
    known_component_nodes = overview_artifact["known"]["component_nodes"]
    known_graph = overview_artifact["known"]["graph"]

    if scope == "cluster":
        focus_df = cluster["source_df"].copy()
        max_triples = CLUSTER_GRAPH_MAX_TRIPLES
    elif scope == "component":
        component_nodes = known_component_nodes.get(cluster["component_id"], set())
        focus_df = _component_frame(session.known_df, component_nodes)
        max_triples = FOCUS_GRAPH_MAX_TRIPLES
    elif scope == "neighborhood":
        start_nodes = set(cluster["heads"]) | {cluster["tail"]}
        neighborhood_nodes = set(start_nodes)
        for node in start_nodes:
            if node in known_graph:
                neighborhood_nodes.update(known_graph.neighbors(node))
        focus_df = session.known_df[
            session.known_df["Head"].isin(neighborhood_nodes)
            & session.known_df["Tail"].isin(neighborhood_nodes)
        ].copy()
        max_triples = NEIGHBORHOOD_GRAPH_MAX_TRIPLES
    else:
        raise KeyError(f"Unsupported cluster scope: {scope}")

    highlighted_nodes = set(cluster["heads"]) | {cluster["tail"]}
    highlighted_edges = {
        _edge_key(row["Head"], row["Relation"], row["Tail"])
        for _, row in cluster["shared_df"].iterrows()
    }
    graph = _build_entity_graph_payload(
        session,
        focus_df,
        view=scope,
        max_triples=max_triples,
        warnings=[cluster["warning"]] if cluster.get("warning") else [],
        highlighted_nodes=highlighted_nodes,
        highlighted_edges=highlighted_edges,
    )

    return {
        "scope": scope,
        "cluster": {
            key: value
            for key, value in cluster.items()
            if key not in {"shared_df", "source_df", "component_summary"}
        },
        "component": cluster["component_summary"],
        "shared_source_triples": _frame_records(session, cluster["shared_df"]),
        "source_triples": _frame_records(session, cluster["source_df"]),
        "relation_tail_pairs": cluster["relation_tail_pairs"],
        "graph": graph,
    }
