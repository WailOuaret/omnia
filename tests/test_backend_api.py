from __future__ import annotations

import json
import subprocess
import sys
import tempfile
import time
import unittest
from pathlib import Path

import requests


REPO_ROOT = Path(__file__).resolve().parents[1]
BASE_URL = "http://127.0.0.1:8010"
MINI_UPLOAD_CSV = (
    b"Head,Relation,Tail\n"
    b"Alice,worksAt,OmniaLab\n"
    b"Bob,worksAt,OmniaLab\n"
    b"Alice,colleague,Bob\n"
    b"Alice,usesTool,Ollama\n"
    b"Bob,usesTool,Ollama\n"
)


class BackendApiIntegrationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls._log_path = Path(tempfile.gettempdir()) / f"omnia-backend-api-{int(time.time())}.log"
        cls._log_handle = cls._log_path.open("w", encoding="utf-8")
        cls._server = subprocess.Popen(
            [
                sys.executable,
                "scripts/run_backend_server.py",
                "--host",
                "127.0.0.1",
                "--port",
                "8010",
            ],
            cwd=REPO_ROOT,
            stdout=cls._log_handle,
            stderr=subprocess.STDOUT,
        )
        cls._wait_for_server()

    @classmethod
    def tearDownClass(cls):
        if hasattr(cls, "_server") and cls._server.poll() is None:
            cls._server.terminate()
            try:
                cls._server.wait(timeout=10)
            except subprocess.TimeoutExpired:
                cls._server.kill()
                cls._server.wait(timeout=10)
        if hasattr(cls, "_log_handle"):
            cls._log_handle.close()

    @classmethod
    def _wait_for_server(cls):
        deadline = time.time() + 90
        last_error: Exception | None = None
        while time.time() < deadline:
            if cls._server.poll() is not None:
                break
            try:
                response = requests.get(f"{BASE_URL}/api/health", timeout=2)
                if response.status_code == 200:
                    return
            except Exception as exc:  # pragma: no cover - depends on local startup timing
                last_error = exc
            time.sleep(1)

        log_output = cls._log_path.read_text(encoding="utf-8", errors="replace")
        raise RuntimeError(
            "Backend API test server did not start.\n"
            f"Last error: {last_error}\n"
            f"Server log:\n{log_output}"
        )

    def assert_ok(self, response: requests.Response):
        self.assertLess(
            response.status_code,
            400,
            f"{response.request.method} {response.request.url} failed with {response.status_code}: {response.text}",
        )

    def create_upload_session(self, *, holdout_mode: bool = True, sample_proportion: float = 0.8) -> str:
        response = requests.post(
            f"{BASE_URL}/api/sessions/upload",
            files={"file": ("api_smoke_upload.csv", MINI_UPLOAD_CSV, "text/csv")},
            data={
                "holdout_mode": str(holdout_mode).lower(),
                "sample_proportion": str(sample_proportion),
            },
            timeout=60,
        )
        self.assert_ok(response)
        return response.json()["session_id"]

    def create_demo_session(self, *, holdout_mode: bool = True, sample_proportion: float = 0.8) -> str:
        return self.create_upload_session(holdout_mode=holdout_mode, sample_proportion=sample_proportion)

    def test_health_samples_and_preview(self):
        health = requests.get(f"{BASE_URL}/api/health", timeout=15)
        self.assert_ok(health)
        self.assertEqual(health.json()["status"], "ok")

        samples = requests.get(f"{BASE_URL}/api/samples", timeout=15)
        self.assert_ok(samples)
        sample_ids = {item["id"] for item in samples.json()["samples"]}
        self.assertTrue(all(s.startswith("omnia_") for s in sample_ids), sample_ids)

        preview = requests.post(
            f"{BASE_URL}/api/datasets/preview",
            files={"file": ("api_smoke_upload.csv", MINI_UPLOAD_CSV, "text/csv")},
            timeout=30,
        )
        self.assert_ok(preview)
        payload = preview.json()
        self.assertEqual(payload["guessed_mapping"]["Head"], "Head")
        self.assertEqual(payload["guessed_mapping"]["Relation"], "Relation")
        self.assertEqual(payload["guessed_mapping"]["Tail"], "Tail")
        self.assertGreater(payload["row_count"], 0)
        self.assertGreaterEqual(len(payload["preview_rows"]), 1)

    def test_upload_session_overview_components_clusters_and_candidates(self):
        session_id = self.create_upload_session(holdout_mode=True)

        session_response = requests.get(f"{BASE_URL}/api/sessions/{session_id}", timeout=15)
        self.assert_ok(session_response)
        session_payload = session_response.json()
        self.assertEqual(session_payload["session_id"], session_id)
        self.assertTrue(session_payload["holdout_mode"])

        logs = requests.get(f"{BASE_URL}/api/sessions/{session_id}/logs", timeout=15)
        self.assert_ok(logs)
        self.assertGreaterEqual(len(logs.json()["logs"]), 1)

        overview = requests.get(f"{BASE_URL}/api/sessions/{session_id}/overview", timeout=30)
        self.assert_ok(overview)
        overview_payload = overview.json()
        self.assertIn("uploaded_stats", overview_payload)
        self.assertGreaterEqual(overview_payload["uploaded_stats"]["triple_count"], 1)
        self.assertGreaterEqual(len(overview_payload["uploaded_components"]), 1)

        component_id = overview_payload["uploaded_components"][0]["component_id"]
        component = requests.get(
            f"{BASE_URL}/api/sessions/{session_id}/components/{component_id}",
            params={"graph_mode": "uploaded"},
            timeout=30,
        )
        self.assert_ok(component)
        component_payload = component.json()
        self.assertEqual(component_payload["component"]["component_id"], component_id)
        self.assertGreaterEqual(component_payload["graph"]["displayed_nodes"], 1)

        clusters = requests.get(f"{BASE_URL}/api/sessions/{session_id}/clusters", timeout=30)
        self.assert_ok(clusters)
        clusters_payload = clusters.json()
        self.assertTrue(isinstance(clusters_payload, list))
        self.assertGreaterEqual(len(clusters_payload), 1)

        cluster_id = clusters_payload[0]["cluster_id"]
        cluster_focus = requests.get(
            f"{BASE_URL}/api/sessions/{session_id}/clusters/{cluster_id}",
            params={"scope": "cluster"},
            timeout=30,
        )
        self.assert_ok(cluster_focus)
        cluster_payload = cluster_focus.json()
        self.assertEqual(cluster_payload["scope"], "cluster")
        self.assertGreaterEqual(len(cluster_payload["cluster"]["heads"]), 1)
        self.assertGreaterEqual(len(cluster_payload["shared_source_triples"]), 1)

        candidates = requests.get(f"{BASE_URL}/api/sessions/{session_id}/candidates", timeout=30)
        self.assert_ok(candidates)
        candidates_payload = candidates.json()
        self.assertTrue(isinstance(candidates_payload, list))
        self.assertGreaterEqual(len(candidates_payload), 1)
        first_candidate = candidates_payload[0]
        self.assertIn("provenance", first_candidate)
        self.assertIn("llm_rationale", first_candidate)

    def test_filter_llm_completed_comparisons_and_exports(self):
        session_id = self.create_demo_session(holdout_mode=True)

        filtering = requests.post(
            f"{BASE_URL}/api/sessions/{session_id}/filter",
            params={"enabled": True, "preferred_device": "cpu"},
            timeout=180,
        )
        self.assert_ok(filtering)
        filtering_payload = filtering.json()
        self.assertTrue(filtering_payload["enabled"])
        self.assertIsNotNone(filtering_payload["threshold"])
        self.assertGreaterEqual(filtering_payload["accepted_count"] + filtering_payload["rejected_count"], 1)
        self.assertGreaterEqual(len(filtering_payload["distances"]), 1)
        self.assertIn("device", filtering_payload["model_info"])

        llm = requests.post(
            f"{BASE_URL}/api/sessions/{session_id}/llm",
            params={
                "format_name": "triples",
                "strategy": "rag",
                "top_k": 2,
                "max_candidates": 6,
                "force_mock": True,
                "use_filter_results": True,
            },
            timeout=180,
        )
        self.assert_ok(llm)
        llm_payload = llm.json()
        self.assertTrue(llm_payload["is_mock"])
        self.assertGreaterEqual(len(llm_payload["candidates"]), 1)
        first_validation = llm_payload["candidates"][0]
        self.assertIn("prompt", first_validation)
        self.assertIn("retrieved_context", first_validation)
        self.assertIn("raw_response", first_validation)
        self.assertIn("decision", first_validation)

        llm_compare = requests.post(
            f"{BASE_URL}/api/sessions/{session_id}/llm/compare",
            params={
                "format_name": "triples",
                "top_k": 2,
                "max_candidates": 4,
                "force_mock": True,
                "use_filter_results": True,
            },
            timeout=180,
        )
        self.assert_ok(llm_compare)
        compare_payload = llm_compare.json()
        strategies = {item["strategy"] for item in compare_payload["strategies"]}
        self.assertEqual(strategies, {"zero", "context", "rag"})
        self.assertTrue(all("focus_candidate" in item for item in compare_payload["strategies"]))

        completed = requests.get(f"{BASE_URL}/api/sessions/{session_id}/completed", timeout=30)
        self.assert_ok(completed)
        completed_payload = completed.json()
        self.assertIn("summary", completed_payload)
        self.assertGreaterEqual(completed_payload["summary"]["completed_triples"], completed_payload["summary"]["known_triples"])

        comparisons = requests.get(
            f"{BASE_URL}/api/sessions/{session_id}/comparisons",
            params={
                "format_name": "triples",
                "strategy": "rag",
                "top_k": 2,
                "max_candidates": 6,
            },
            timeout=180,
        )
        self.assert_ok(comparisons)
        comparison_payload = comparisons.json()
        baseline_ids = {item["id"] for item in comparison_payload["baselines"]}
        self.assertIn("omnia_full", baseline_ids)
        self.assertIn("filtering_only", baseline_ids)
        self.assertIn("llm_only", baseline_ids)

        csv_export = requests.get(f"{BASE_URL}/api/sessions/{session_id}/export/diff.csv", timeout=30)
        self.assert_ok(csv_export)
        self.assertIn("Head,Relation,Tail", csv_export.text)

        json_export = requests.get(f"{BASE_URL}/api/sessions/{session_id}/export/diff.json", timeout=30)
        self.assert_ok(json_export)
        exported = json.loads(json_export.text)
        self.assertIsInstance(exported, list)

    def test_pipeline_run_endpoint_completes_demo_flow(self):
        session_id = self.create_demo_session(holdout_mode=True)

        pipeline_run = requests.post(
            f"{BASE_URL}/api/sessions/{session_id}/pipeline/run",
            params={
                "format_name": "triples",
                "strategy": "zero",
                "top_k": 2,
                "max_candidates": 6,
                "filtering_enabled": False,
                "force_mock": True,
            },
            timeout=180,
        )
        self.assert_ok(pipeline_run)
        payload = pipeline_run.json()
        completed_steps = {step["name"] for step in payload["steps"] if step["status"] == "completed"}
        self.assertIn("candidate_generation", completed_steps)
        self.assertIn("transe_filtering", completed_steps)
        self.assertIn("llm_validation", completed_steps)
        self.assertIn("completed_kg", completed_steps)
        self.assertGreaterEqual(payload["summary"]["accepted_additions"], 0)


if __name__ == "__main__":
    unittest.main()
