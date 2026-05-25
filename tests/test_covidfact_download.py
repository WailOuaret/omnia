"""Tests for COVID-Fact JSONL download on disk."""

from __future__ import annotations

import json
import unittest
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
JSONL_PATH = REPO_ROOT / "data" / "covidfact" / "COVIDFACT_dataset.jsonl"
EXPECTED_ROWS = 4086
ROW_TOLERANCE = 50


class CovidFactDownloadTests(unittest.TestCase):
    def test_jsonl_exists(self) -> None:
        self.assertTrue(JSONL_PATH.exists(), f"Missing {JSONL_PATH}")

    def test_jsonl_not_empty(self) -> None:
        self.assertGreater(JSONL_PATH.stat().st_size, 0)

    def test_jsonl_rows_parse(self) -> None:
        rows = 0
        bad = 0
        with JSONL_PATH.open(encoding="utf-8") as handle:
            for line in handle:
                if not line.strip():
                    continue
                try:
                    json.loads(line)
                    rows += 1
                except json.JSONDecodeError:
                    bad += 1
        self.assertGreater(rows, 0)
        self.assertEqual(bad, 0)
        self.assertAlmostEqual(rows, EXPECTED_ROWS, delta=ROW_TOLERANCE)

    def test_jsonl_has_claim_and_label_fields(self) -> None:
        with JSONL_PATH.open(encoding="utf-8") as handle:
            first = json.loads(handle.readline())
        self.assertIn("claim", first)
        self.assertIn("label", first)
        self.assertNotIn("Head", first)
        self.assertNotIn("Relation", first)
        self.assertNotIn("Tail", first)


if __name__ == "__main__":
    unittest.main()
