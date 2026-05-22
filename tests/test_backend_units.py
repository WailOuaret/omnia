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


if __name__ == "__main__":
    unittest.main()
