"""Tests for COVID-Fact backend /api/samples status."""

from __future__ import annotations

import unittest

from fastapi.testclient import TestClient

from backend.app.main import app


class CovidFactStatusTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.client = TestClient(app)
        response = cls.client.get("/api/samples")
        response.raise_for_status()
        cls.samples = {s["id"]: s for s in response.json()["samples"]}

    def test_covid_fact_sample_present(self) -> None:
        self.assertIn("omnia_covid_fact", self.samples)

    def test_covid_fact_source_available(self) -> None:
        covid = self.samples["omnia_covid_fact"]
        self.assertTrue(covid.get("source_available"), covid)

    def test_covid_fact_kg_loader_not_available(self) -> None:
        covid = self.samples["omnia_covid_fact"]
        self.assertFalse(covid.get("kg_loader_available"), covid)

    def test_covid_fact_not_available_as_kg_session(self) -> None:
        covid = self.samples["omnia_covid_fact"]
        self.assertFalse(covid.get("available"), covid)

    def test_covid_fact_status_message(self) -> None:
        covid = self.samples["omnia_covid_fact"]
        if covid.get("source_available"):
            self.assertIn("KG converter pending", covid.get("status_message", ""))

    def test_covid_fact_jsonl_row_count_reported(self) -> None:
        covid = self.samples["omnia_covid_fact"]
        if covid.get("source_available"):
            rows = covid.get("stats", {}).get("jsonl_claim_rows", 0)
            self.assertGreater(rows, 4000)

    def test_benchmark_kgs_still_available(self) -> None:
        for sample_id in ("omnia_codex_m", "omnia_fb15k-237", "omnia_wn18rr"):
            sample = self.samples[sample_id]
            self.assertTrue(sample.get("available"), f"{sample_id} should remain available")


if __name__ == "__main__":
    unittest.main()
