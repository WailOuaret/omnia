from __future__ import annotations

import json
import unittest
from datetime import datetime

import pandas as pd
from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.config import BENCHMARK_SAMPLE_PREFIX
from backend.app.services import analytics, feedback, ingestion, pipeline
from backend.app.store import SESSIONS, log_event
from candidates_filtering import triple_filter


def demo_df() -> pd.DataFrame:
    return pd.DataFrame(
        [
            {"Head": "Alice", "Relation": "worksAt", "Tail": "OmniaLab"},
            {"Head": "Bob", "Relation": "worksAt", "Tail": "OmniaLab"},
            {"Head": "Carla", "Relation": "worksAt", "Tail": "OmniaLab"},
            {"Head": "Alice", "Relation": "researches", "Tail": "GraphCompletion"},
            {"Head": "Bob", "Relation": "researches", "Tail": "GraphCompletion"},
            {"Head": "Carla", "Relation": "researches", "Tail": "GraphCompletion"},
            {"Head": "Alice", "Relation": "usesTool", "Tail": "Ollama"},
            {"Head": "Carla", "Relation": "usesTool", "Tail": "Ollama"},
            {"Head": "Eli", "Relation": "usesTool", "Tail": "Ollama"},
            {"Head": "Dana", "Relation": "researches", "Tail": "SparseKG"},
            {"Head": "Eli", "Relation": "researches", "Tail": "SparseKG"},
            {"Head": "Dana", "Relation": "worksAt", "Tail": "InsightHub"},
            {"Head": "Eli", "Relation": "worksAt", "Tail": "InsightHub"},
            {"Head": "Dana", "Relation": "livesIn", "Tail": "Paris"},
            {"Head": "Eli", "Relation": "livesIn", "Tail": "Lyon"},
            {"Head": "Gina", "Relation": "studiesAt", "Tail": "DataCampus"},
            {"Head": "Faris", "Relation": "worksAt", "Tail": "RemoteNode"},
        ]
    )


def large_demo_df() -> pd.DataFrame:
    rows: list[dict[str, str]] = []
    for index in range(40):
        rows.append({"Head": f"Researcher{index}", "Relation": "worksAt", "Tail": "OmniaLab"})
        rows.append({"Head": f"Researcher{index}", "Relation": "researches", "Tail": f"Topic{index % 5}"})
        rows.append({"Head": f"Researcher{index}", "Relation": "usesTool", "Tail": "Ollama"})
    return pd.DataFrame(rows)


class BackendUnitTests(unittest.TestCase):
    def setUp(self):
        SESSIONS.clear()
        self.client = TestClient(app)

    def test_read_dataframe_from_bytes_supports_csv_tsv_and_json(self):
        csv_df = ingestion.read_dataframe_from_bytes(
            b"Head,Relation,Tail\nAlice,worksAt,OmniaLab\n",
            "demo.csv",
        )
        tsv_df = ingestion.read_dataframe_from_bytes(
            b"Head\tRelation\tTail\nBob\tworksAt\tOmniaLab\n",
            "demo.tsv",
        )
        json_df = ingestion.read_dataframe_from_bytes(
            json.dumps([{"Head": "Carla", "Relation": "worksAt", "Tail": "OmniaLab"}]).encode("utf-8"),
            "demo.json",
        )

        self.assertEqual(csv_df.iloc[0]["Head"], "Alice")
        self.assertEqual(tsv_df.iloc[0]["Tail"], "OmniaLab")
        self.assertEqual(json_df.iloc[0]["Relation"], "worksAt")

    def test_read_dataframe_from_bytes_detects_headerless_benchmark_tsv(self):
        benchmark_like = ingestion.read_dataframe_from_bytes(
            b"/m/alice\t/people/person/employment_history\t/m/omnia_lab\n"
            b"/m/bob\t/people/person/employment_history\t/m/omnia_lab\n",
            "train.tsv",
        )

        self.assertEqual(benchmark_like.columns.tolist(), ["Head", "Relation", "Tail"])
        self.assertEqual(benchmark_like.iloc[0]["Head"], "/m/alice")
        self.assertEqual(benchmark_like.iloc[1]["Tail"], "/m/omnia_lab")

    def test_preview_and_mapping_guess_alias_columns(self):
        raw_df = pd.DataFrame(
            [
                {"subject": "Alice", "predicate": "worksAt", "object": "OmniaLab"},
                {"subject": "Bob", "predicate": "worksAt", "object": "OmniaLab"},
            ]
        )

        preview = ingestion.build_preview(raw_df)

        self.assertEqual(preview["guessed_mapping"]["Head"], "subject")
        self.assertEqual(preview["guessed_mapping"]["Relation"], "predicate")
        self.assertEqual(preview["guessed_mapping"]["Tail"], "object")

    def test_graph_stats_and_overview_use_component_summaries_for_large_graphs(self):
        session = ingestion.create_session_from_dataframe(
            dataset_name="Large KG",
            source_type="upload",
            source_path=None,
            df=large_demo_df(),
            mapping={"Head": "Head", "Relation": "Relation", "Tail": "Tail"},
            holdout_mode=False,
        )

        stats = analytics.compute_graph_stats(session.uploaded_df)
        overview = analytics.build_overview_payload(session)

        self.assertGreaterEqual(stats["entity_count"], 41)
        self.assertTrue(overview["graph_policy"]["uploaded"]["large_dataset_mode"])
        self.assertEqual(overview["graph_policy"]["uploaded"]["default_level"], "summary")
        self.assertTrue(overview["uploaded_summary_graph"]["aggregated"])
        self.assertGreaterEqual(len(overview["uploaded_components"]), 1)

    def test_cluster_focus_payload_returns_scoped_subgraphs(self):
        session = ingestion.create_session_from_dataframe(
            dataset_name="Cluster KG",
            source_type="upload",
            source_path=None,
            df=demo_df(),
            mapping={"Head": "Head", "Relation": "Relation", "Tail": "Tail"},
            holdout_mode=False,
        )

        cluster_payload = analytics.build_cluster_payload(session)
        cluster_id = cluster_payload["clusters"][0]["cluster_id"]

        cluster_focus = analytics.build_cluster_focus_payload(session, cluster_id, scope="cluster")
        component_focus = analytics.build_cluster_focus_payload(session, cluster_id, scope="component")
        neighborhood_focus = analytics.build_cluster_focus_payload(session, cluster_id, scope="neighborhood")

        self.assertEqual(cluster_focus["scope"], "cluster")
        self.assertEqual(component_focus["scope"], "component")
        self.assertEqual(neighborhood_focus["scope"], "neighborhood")
        self.assertGreaterEqual(len(cluster_focus["shared_source_triples"]), 2)
        self.assertGreaterEqual(component_focus["graph"]["displayed_nodes"], cluster_focus["graph"]["displayed_nodes"])
        self.assertGreaterEqual(neighborhood_focus["graph"]["displayed_nodes"], cluster_focus["graph"]["displayed_nodes"])

    def test_candidate_generation_tracks_provenance(self):
        session = ingestion.create_session_from_dataframe(
            dataset_name="Candidate KG",
            source_type="upload",
            source_path=None,
            df=demo_df(),
            mapping={"Head": "Head", "Relation": "Relation", "Tail": "Tail"},
            holdout_mode=False,
        )

        candidates = pipeline.ensure_candidates(session)
        candidate_df = candidates["candidates_df"]
        generated = candidate_df[~candidate_df["status_duplicate_existing"]]

        self.assertGreater(len(candidate_df), 0)
        self.assertTrue({"cluster_ids", "cluster_keys", "source_heads", "provenance", "rationale"}.issubset(candidate_df.columns))
        self.assertGreater(len(generated), 0)
        self.assertTrue(all(isinstance(value, list) for value in generated["cluster_ids"].head(3)))

    def test_threshold_logic_prefers_best_reduction_coverage_tradeoff(self):
        candidates_df = pd.DataFrame(
            [
                {"Head": "Alice", "Relation": "worksAt", "Tail": "OmniaLab", "distance": 0.1},
                {"Head": "Bob", "Relation": "worksAt", "Tail": "OmniaLab", "distance": 0.3},
                {"Head": "Carla", "Relation": "worksAt", "Tail": "OmniaLab", "distance": 0.5},
                {"Head": "Dana", "Relation": "worksAt", "Tail": "OmniaLab", "distance": 0.8},
            ]
        )
        missing_df = pd.DataFrame(
            [
                {"Head": "Alice", "Relation": "worksAt", "Tail": "OmniaLab"},
                {"Head": "Carla", "Relation": "worksAt", "Tail": "OmniaLab"},
            ]
        )

        diagnostics = triple_filter.get_threshold_diagnostics(candidates_df, missing_df, threshold_list=[0.2, 0.4, 0.7])
        best_threshold, filtered_df = triple_filter.filter_best_threshold(
            model=None,
            candidates_df=candidates_df,
            missing_df=missing_df,
            train_df=pd.DataFrame(),
            threshold_list=[0.2, 0.4, 0.7],
        )

        self.assertEqual(best_threshold, 0.2)
        self.assertEqual(len(filtered_df), 1)
        self.assertEqual(diagnostics[0]["accepted_count"], 1)
        self.assertGreater(diagnostics[0]["score"], diagnostics[1]["score"])

    def test_log_events_keep_explainability_shape(self):
        session = ingestion.create_session_from_dataframe(
            dataset_name="Logs KG",
            source_type="upload",
            source_path=None,
            df=demo_df(),
            mapping={"Head": "Head", "Relation": "Relation", "Tail": "Tail"},
            holdout_mode=False,
        )

        log_event(session, "candidate_generation", "info", "Generated candidates.", {"count": 4})
        entry = session.logs[-1]

        self.assertEqual(entry["step"], "candidate_generation")
        self.assertEqual(entry["level"], "info")
        self.assertEqual(entry["details"]["count"], 4)
        self.assertIsInstance(datetime.fromisoformat(entry["timestamp"]), datetime)

    def test_completed_diff_uses_filter_acceptances_when_llm_not_run(self):
        session = ingestion.create_session_from_dataframe(
            dataset_name="Completed KG",
            source_type="upload",
            source_path=None,
            df=demo_df(),
            mapping={"Head": "Head", "Relation": "Relation", "Tail": "Tail"},
            holdout_mode=False,
        )

        pipeline.ensure_candidates(session)
        filtering_artifact = pipeline.run_filtering(session, enabled=False)
        completed = pipeline.get_completed_payload(session)

        self.assertFalse(filtering_artifact["enabled"])
        self.assertGreater(completed["summary"]["accepted_additions"], 0)
        self.assertGreater(completed["summary"]["completed_triples"], completed["summary"]["known_triples"])
        self.assertTrue(len(completed["additions"]) > 0)

    def test_list_samples_only_exposes_authoritative_benchmark_ids(self):
        samples = ingestion.list_samples()
        sample_ids = {sample["id"] for sample in samples}
        self.assertTrue(all(sid.startswith(BENCHMARK_SAMPLE_PREFIX) for sid in sample_ids), sample_ids)

    def test_samples_reports_real_dataset_availability(self):
        samples = ingestion.list_samples()
        required = {"omnia_codex_m", "omnia_fb15k-237", "omnia_wn18rr", "omnia_covid_fact"}
        ids = {sample["id"] for sample in samples}
        self.assertTrue(required.issubset(ids), ids)
        codex = next(sample for sample in samples if sample["id"] == "omnia_codex_m")
        self.assertIn("available", codex)
        if not codex["available"]:
            hint = codex.get("setup_hint") or ""
            self.assertTrue("setup_omnia_datasets.py" in hint or "setup_real_datasets.py" in hint, hint)
        covid = next(sample for sample in samples if sample["id"] == "omnia_covid_fact")
        self.assertIn("source_available", covid)
        self.assertIn("kg_loader_available", covid)
        if covid.get("source_available"):
            self.assertFalse(covid.get("kg_loader_available"))
            self.assertFalse(covid.get("available"))

    def test_create_session_from_real_codex_m_if_available(self):
        samples = ingestion.list_samples()
        codex = next(sample for sample in samples if sample["id"] == "omnia_codex_m")
        if not codex.get("available"):
            self.skipTest("Real CoDEx-M dataset not available on this machine.")
        session = ingestion.create_session_from_sample("omnia_codex_m", holdout_mode=True, sample_proportion=0.8)
        self.assertEqual(session.artifacts.get("sample_id"), "omnia_codex_m")
        self.assertEqual(session.source_type, "real_dataset")
        self.assertGreater(len(session.uploaded_df), 0)

    def _build_feedback_session(self):
        session = ingestion.create_session_from_dataframe(
            dataset_name="Feedback KG",
            source_type="upload",
            source_path=None,
            df=demo_df(),
            mapping={"Head": "Head", "Relation": "Relation", "Tail": "Tail"},
            holdout_mode=False,
        )
        candidates = pipeline.ensure_candidates(session)
        candidate = candidates["filterable_df"].iloc[0]
        return session, candidate

    def _triple_in_records(self, records: list[dict[str, str]], head: str, relation: str, tail: str) -> bool:
        return any(
            row.get("Head") == head and row.get("Relation") == relation and row.get("Tail") == tail
            for row in records
        )

    def test_feedback_accept_adds_triple_to_completed_kg(self):
        session, candidate = self._build_feedback_session()
        feedback.record_feedback(
            session,
            candidate_id=str(candidate["candidate_id"]),
            head=str(candidate["Head"]),
            relation=str(candidate["Relation"]),
            tail=str(candidate["Tail"]),
            decision="accept",
            reason="correct",
        )
        completed = pipeline.get_completed_payload(session)
        self.assertTrue(
            self._triple_in_records(
                completed["additions"],
                str(candidate["Head"]),
                str(candidate["Relation"]),
                str(candidate["Tail"]),
            )
        )

    def test_feedback_reject_removes_llm_accepted_triple(self):
        session, candidate = self._build_feedback_session()
        session.artifacts["llm"] = {
            "evaluated_df": pd.DataFrame(
                [
                    {
                        "Head": candidate["Head"],
                        "Relation": candidate["Relation"],
                        "Tail": candidate["Tail"],
                        "decision": "accepted",
                        "candidate_id": candidate["candidate_id"],
                    }
                ]
            ),
            "strategy": "rag",
            "mode": "triples",
            "top_k": 2,
        }
        feedback.record_feedback(
            session,
            candidate_id=str(candidate["candidate_id"]),
            head=str(candidate["Head"]),
            relation=str(candidate["Relation"]),
            tail=str(candidate["Tail"]),
            decision="reject",
            reason="wrong_relation",
        )
        completed = pipeline.get_completed_payload(session)
        self.assertFalse(
            self._triple_in_records(
                completed["additions"],
                str(candidate["Head"]),
                str(candidate["Relation"]),
                str(candidate["Tail"]),
            )
        )
        self.assertTrue(
            self._triple_in_records(
                completed["rejected"],
                str(candidate["Head"]),
                str(candidate["Relation"]),
                str(candidate["Tail"]),
            )
        )

    def test_feedback_uncertain_puts_triple_in_unresolved(self):
        session, candidate = self._build_feedback_session()
        feedback.record_feedback(
            session,
            candidate_id=str(candidate["candidate_id"]),
            head=str(candidate["Head"]),
            relation=str(candidate["Relation"]),
            tail=str(candidate["Tail"]),
            decision="uncertain",
            reason="not_enough_evidence",
        )
        completed = pipeline.get_completed_payload(session)
        self.assertTrue(
            self._triple_in_records(
                completed["unresolved"],
                str(candidate["Head"]),
                str(candidate["Relation"]),
                str(candidate["Tail"]),
            )
        )

    def test_feedback_correct_replaces_original_with_corrected(self):
        session, candidate = self._build_feedback_session()
        corrected = {"Head": "Bob", "Relation": "livesIn", "Tail": "Paris"}
        feedback.record_feedback(
            session,
            candidate_id=str(candidate["candidate_id"]),
            head=str(candidate["Head"]),
            relation=str(candidate["Relation"]),
            tail=str(candidate["Tail"]),
            decision="correct",
            reason="wrong_tail",
            corrected_triple=corrected,
        )
        completed = pipeline.get_completed_payload(session)
        self.assertTrue(
            self._triple_in_records(
                completed["rejected"],
                str(candidate["Head"]),
                str(candidate["Relation"]),
                str(candidate["Tail"]),
            )
        )
        self.assertTrue(
            self._triple_in_records(
                completed["additions"],
                corrected["Head"],
                corrected["Relation"],
                corrected["Tail"],
            )
        )

    def test_feedback_export_endpoint_returns_json(self):
        session, candidate = self._build_feedback_session()
        response = self.client.post(
            f"/api/sessions/{session.session_id}/feedback",
            json={
                "candidate_id": str(candidate["candidate_id"]),
                "Head": str(candidate["Head"]),
                "Relation": str(candidate["Relation"]),
                "Tail": str(candidate["Tail"]),
                "decision": "accept",
                "reason": "correct",
            },
        )
        self.assertEqual(response.status_code, 200)
        export_response = self.client.get(f"/api/sessions/{session.session_id}/export/feedback.json")
        self.assertEqual(export_response.status_code, 200)
        payload = json.loads(export_response.text)
        self.assertTrue(isinstance(payload, list))
        self.assertGreaterEqual(len(payload), 1)

    def test_completed_count_after_accept_correct_reject_matches_completed_kg_length(self):
        """Regression for Ticket 2: the displayed completed count must equal the
        actual completed-KG row count after a mixed Accept + Correct + Reject
        sequence. The frontend consumes this same `summary.completed_triples`
        value from `GET /api/sessions/{id}/completed`.
        """
        session, candidate = self._build_feedback_session()

        # Seed an LLM artifact with three accepted candidates so each decision has
        # a triple to act on.
        other_candidates = [
            {"Head": "Alice", "Relation": "researches", "Tail": "ProtonField", "candidate_id": "cand-2"},
            {"Head": "Bob", "Relation": "usesTool", "Tail": "OmniaCLI", "candidate_id": "cand-3"},
        ]
        session.artifacts["llm"] = {
            "evaluated_df": pd.DataFrame(
                [
                    {
                        "Head": candidate["Head"],
                        "Relation": candidate["Relation"],
                        "Tail": candidate["Tail"],
                        "decision": "accepted",
                        "candidate_id": candidate["candidate_id"],
                    },
                    *[{**row, "decision": "accepted"} for row in other_candidates],
                ]
            ),
            "strategy": "rag",
            "mode": "triples",
            "top_k": 2,
        }

        feedback.record_feedback(
            session,
            candidate_id=str(candidate["candidate_id"]),
            head=str(candidate["Head"]),
            relation=str(candidate["Relation"]),
            tail=str(candidate["Tail"]),
            decision="accept",
            reason="correct",
        )
        feedback.record_feedback(
            session,
            candidate_id="cand-2",
            head="Alice",
            relation="researches",
            tail="ProtonField",
            decision="correct",
            reason="wrong_tail",
            corrected_triple={"Head": "Alice", "Relation": "researches", "Tail": "QuantumField"},
        )
        feedback.record_feedback(
            session,
            candidate_id="cand-3",
            head="Bob",
            relation="usesTool",
            tail="OmniaCLI",
            decision="reject",
            reason="wrong_relation",
        )

        completed = pipeline.get_completed_payload(session)
        summary_completed = completed["summary"]["completed_triples"]
        # The completed KG ground-truth row count is known + accepted additions, deduplicated.
        actual_completed_kg = pd.concat(
            [
                session.known_df[["Head", "Relation", "Tail"]],
                pd.DataFrame(completed["additions"])[["Head", "Relation", "Tail"]],
            ],
            ignore_index=True,
        ).drop_duplicates()
        self.assertEqual(summary_completed, len(actual_completed_kg))
        # The corrected triple must be present, the rejected one must be absent.
        self.assertTrue(
            self._triple_in_records(completed["additions"], "Alice", "researches", "QuantumField")
        )
        self.assertFalse(
            self._triple_in_records(completed["additions"], "Bob", "usesTool", "OmniaCLI")
        )

    def test_export_completed_tsv_contains_original_and_accepted_triples(self):
        session, candidate = self._build_feedback_session()
        feedback.record_feedback(
            session,
            candidate_id="cov-c1",
            head="chloroquine",
            relation="treats",
            tail="sars-cov-2",
            decision="accept",
            reason="correct",
        )
        feedback.record_feedback(
            session,
            candidate_id=str(candidate["candidate_id"]),
            head=str(candidate["Head"]),
            relation=str(candidate["Relation"]),
            tail=str(candidate["Tail"]),
            decision="reject",
            reason="wrong_relation",
        )
        export_response = self.client.get(f"/api/sessions/{session.session_id}/export/completed.tsv")
        self.assertEqual(export_response.status_code, 200)
        self.assertIn("text/tab-separated-values", export_response.headers.get("content-type", ""))
        text = export_response.text
        lines = [line for line in text.strip().splitlines() if line.strip()]
        self.assertEqual(lines[0], "head\trelation\ttail\tprovenance")
        self.assertIn("chloroquine\ttreats\tsars-cov-2\thuman_confirmed", text)
        self.assertIn("\toriginal", text)
        rejected_line = f"{candidate['Head']}\t{candidate['Relation']}\t{candidate['Tail']}\thuman_rejected"
        self.assertNotIn(rejected_line, text)


class GraphSliceEndpointTests(unittest.TestCase):
    """Acceptance tests for the new backend-first paper-demo slice endpoints."""

    def setUp(self) -> None:  # noqa: D401 - unittest hook
        SESSIONS.clear()
        self.client = TestClient(app)
        self.session = ingestion.create_session_from_dataframe(
            dataset_name="Slice KG",
            source_type="upload",
            source_path=None,
            df=demo_df(),
            mapping={"Head": "Head", "Relation": "Relation", "Tail": "Tail"},
            holdout_mode=False,
        )
        # Pre-compute candidates so the candidates endpoint has artifacts to read.
        pipeline.ensure_candidates(self.session)
        self.session_id = self.session.session_id

    def test_entities_endpoint_returns_real_session_entities(self) -> None:
        response = self.client.get(f"/api/sessions/{self.session_id}/entities?limit=50")
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["source"], "backend_session")
        ids = {item["id"] if isinstance(item, dict) else item for item in payload["entities"]}
        self.assertIn("Alice", ids)
        self.assertIn("OmniaLab", ids)

    def test_relations_endpoint_filters_by_query(self) -> None:
        response = self.client.get(f"/api/sessions/{self.session_id}/relations?q=works")
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["source"], "backend_session")
        labels = [item["label"] for item in payload["relations"]]
        self.assertIn("worksAt", labels)
        # Confirm filtering really applied.
        self.assertTrue(all("works" in rel.lower() for rel in labels))

    def test_graph_slice_guided_returns_bounded_payload(self) -> None:
        response = self.client.get(
            f"/api/sessions/{self.session_id}/graph/slice?mode=guided&limit_nodes=10&limit_edges=15"
        )
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["source"], "backend_session")
        self.assertLessEqual(payload["stats"]["nodes"], 10)
        self.assertLessEqual(payload["stats"]["edges"], 15)
        self.assertGreater(payload["stats"]["nodes"], 0)
        # Every node must come from the real session, not static data.
        for node in payload["nodes"]:
            self.assertEqual(node["source"], "backend_session")
        self.assertIn("data_available", payload)
        self.assertIn("clusters", payload)
        self.assertIn("candidates", payload)

    def test_graph_slice_entity_mode_returns_neighborhood(self) -> None:
        response = self.client.get(
            f"/api/sessions/{self.session_id}/graph/slice?mode=entity&entity=Alice&depth=1"
        )
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        node_ids = {node["id"] for node in payload["nodes"]}
        self.assertIn("Alice", node_ids)
        # Alice has worksAt OmniaLab + researches GraphCompletion + usesTool Ollama in the demo.
        self.assertTrue({"OmniaLab", "GraphCompletion", "Ollama"} & node_ids)

    def test_graph_slice_uses_session_triples_not_static(self) -> None:
        response = self.client.get(
            f"/api/sessions/{self.session_id}/graph/slice?mode=guided&limit_nodes=20&limit_edges=30"
        )
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        node_ids = {node["id"] for node in payload["nodes"]}
        self.assertIn("Alice", node_ids)
        self.assertNotIn("Eiffel Tower", node_ids)
        self.assertEqual(payload["source"], "backend_session")

    def test_clusters_detailed_endpoint_returns_real_clusters(self) -> None:
        response = self.client.get(f"/api/sessions/{self.session_id}/clusters/detailed")
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["source"], "backend_session")
        self.assertGreater(payload["count"], 0)
        first = payload["clusters"][0]
        self.assertIn("cluster_id", first)
        self.assertIn("shared_relation", first)
        self.assertIn("shared_tail", first)
        self.assertIn("members", first)

    def test_candidates_detailed_returns_candidate_id_and_buckets(self) -> None:
        response = self.client.get(f"/api/sessions/{self.session_id}/candidates/detailed?limit=10")
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["source"], "backend_session")
        self.assertGreater(payload["count"], 0)
        first = payload["candidates"][0]
        self.assertIn("candidate_id", first)
        self.assertIn("status_bucket", first)
        self.assertTrue(first["candidate_id"])  # deterministic SHA-style id

    def test_candidates_endpoint_includes_candidate_id_distance_llm_fields(self) -> None:
        response = self.client.get(f"/api/sessions/{self.session_id}/candidates?limit=10")
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertTrue(isinstance(payload, list))
        self.assertGreater(len(payload), 0)
        first = payload[0]
        self.assertIn("candidate_id", first)
        self.assertIn("distance", first)
        self.assertIn("llm_decision", first)
        self.assertIn("llm_rationale", first)

    def test_completed_payload_after_feedback_uses_real_candidate(self) -> None:
        candidates_response = self.client.get(f"/api/sessions/{self.session_id}/candidates?limit=1")
        self.assertEqual(candidates_response.status_code, 200)
        candidates = candidates_response.json()
        self.assertGreater(len(candidates), 0)
        candidate = candidates[0]
        feedback_response = self.client.post(
            f"/api/sessions/{self.session_id}/feedback",
            json={
                "candidate_id": candidate["candidate_id"],
                "Head": candidate["Head"],
                "Relation": candidate["Relation"],
                "Tail": candidate["Tail"],
                "decision": "accept",
                "reason": "correct",
            },
        )
        self.assertEqual(feedback_response.status_code, 200)
        completed_response = self.client.get(f"/api/sessions/{self.session_id}/completed")
        self.assertEqual(completed_response.status_code, 200)
        completed = completed_response.json()
        additions = completed.get("additions", [])
        self.assertTrue(
            any(
                row.get("Head") == candidate["Head"]
                and row.get("Relation") == candidate["Relation"]
                and row.get("Tail") == candidate["Tail"]
                for row in additions
            )
        )


class OmniaDemoSliceTests(unittest.TestCase):
    def _session_with_candidates(self):
        session = ingestion.create_session_from_dataframe(
            dataset_name="OMNIA demo",
            source_type="upload",
            source_path=None,
            df=demo_df(),
            mapping={"Head": "Head", "Relation": "Relation", "Tail": "Tail"},
            holdout_mode=False,
        )
        pipeline.ensure_candidates(session)
        return session

    def test_build_omnia_demo_slice_prefers_relation_tail_cluster(self) -> None:
        from backend.app.services.omnia_demo_slice import build_omnia_demo_slice

        session = self._session_with_candidates()
        payload = build_omnia_demo_slice(
            session,
            "demo",
            limit_nodes=100,
            limit_edges=150,
            mode="guided",
        )
        self.assertTrue(payload.get("data_available"))
        selected = payload.get("selected_cluster") or {}
        self.assertGreaterEqual(int(selected.get("size") or 0), 2)
        self.assertIn("shared_relation", selected)
        self.assertIn("shared_tail", selected)
        self.assertGreater(len(payload.get("candidates") or []), 0)
        explanation = payload.get("explanation") or {}
        self.assertIn("filtering_available", explanation)
        self.assertIn("llm_available", explanation)
        members = set(selected.get("members") or [])
        known_heads = {
            edge["source"]
            for edge in payload.get("edges") or []
            if edge.get("status") == "known" and edge.get("target") == selected.get("shared_tail")
        }
        self.assertTrue(members.intersection(known_heads))

    def test_omnia_demo_slice_selected_candidate_belongs_to_cluster(self) -> None:
        from backend.app.services.omnia_demo_slice import build_omnia_demo_slice

        session = self._session_with_candidates()
        payload = build_omnia_demo_slice(session, "demo", mode="omnia_demo")
        cluster = payload.get("selected_cluster") or {}
        candidate = payload.get("selected_candidate")
        if candidate:
            cluster_id = str(cluster.get("cluster_id"))
            cluster_ids = candidate.get("cluster_ids") or []
            source_cluster = candidate.get("source_cluster")
            self.assertTrue(cluster_id in cluster_ids or source_cluster == cluster_id)

    def test_omnia_demo_slice_prefers_cluster_with_candidates(self) -> None:
        from backend.app.services.omnia_demo_slice import build_omnia_demo_slice

        session = self._session_with_candidates()
        payload = build_omnia_demo_slice(session, "demo", mode="omnia_demo")
        cluster = payload.get("selected_cluster") or {}
        self.assertGreater(int(cluster.get("candidate_count") or 0), 0)

    def test_omnia_demo_slice_returns_null_candidate_if_no_candidates(self) -> None:
        from backend.app.services.omnia_demo_slice import build_omnia_demo_slice

        session = ingestion.create_session_from_dataframe(
            dataset_name="OMNIA demo",
            source_type="upload",
            source_path=None,
            df=pd.DataFrame([{"Head": "A", "Relation": "r", "Tail": "T"}]),
            mapping={"Head": "Head", "Relation": "Relation", "Tail": "Tail"},
            holdout_mode=False,
        )
        payload = build_omnia_demo_slice(session, "demo", mode="omnia_demo")
        self.assertIsNone(payload.get("selected_candidate"))

    def test_omnia_demo_slice_enforces_limits(self) -> None:
        from backend.app.services.omnia_demo_slice import build_omnia_demo_slice

        session = self._session_with_candidates()
        payload = build_omnia_demo_slice(session, "demo", limit_nodes=100, limit_edges=150, mode="omnia_demo")
        self.assertLessEqual(len(payload.get("nodes") or []), 100)
        self.assertLessEqual(len(payload.get("edges") or []), 150)

    def test_omnia_demo_slice_expand_context_returns_more_nodes(self) -> None:
        from backend.app.services.omnia_demo_slice import build_omnia_demo_slice

        session = ingestion.create_session_from_dataframe(
            dataset_name="OMNIA demo",
            source_type="upload",
            source_path=None,
            df=large_demo_df(),
            mapping={"Head": "Head", "Relation": "Relation", "Tail": "Tail"},
            holdout_mode=False,
        )
        pipeline.ensure_candidates(session)
        compact = build_omnia_demo_slice(session, "demo", limit_nodes=100, expand_context=False)
        expanded = build_omnia_demo_slice(session, "demo", limit_nodes=100, expand_context=True)
        self.assertGreaterEqual(
            len(expanded.get("nodes") or []),
            len(compact.get("nodes") or []),
        )


if __name__ == "__main__":
    unittest.main()
