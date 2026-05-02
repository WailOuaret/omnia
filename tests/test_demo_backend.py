from __future__ import annotations

import unittest

import pandas as pd

from backend.app.services.ingestion import canonicalize_dataframe, create_session_from_dataframe
from backend.app.services.pipeline import ensure_candidates, get_completed_payload, run_filtering, run_llm_validation


class DemoBackendTests(unittest.TestCase):
    def test_canonicalize_dataframe_maps_and_deduplicates(self):
        raw_df = pd.DataFrame(
            [
                {"subject": "Alice", "predicate": "worksAt", "object": "OmniaLab"},
                {"subject": "Alice", "predicate": "worksAt", "object": "OmniaLab"},
                {"subject": "Bob", "predicate": "worksAt", "object": "OmniaLab"},
            ]
        )
        canonical_df, diagnostics = canonicalize_dataframe(
            raw_df,
            mapping={"Head": "subject", "Relation": "predicate", "Tail": "object"},
        )
        self.assertEqual(list(canonical_df.columns), ["Head", "Relation", "Tail"])
        self.assertEqual(len(canonical_df), 2)
        self.assertEqual(diagnostics["dropped_duplicates"], 1)

    def test_pipeline_mock_flow_tracks_completion(self):
        df = pd.DataFrame(
            [
                {"Head": "Alice", "Relation": "worksAt", "Tail": "OmniaLab"},
                {"Head": "Bob", "Relation": "worksAt", "Tail": "OmniaLab"},
                {"Head": "Alice", "Relation": "usesTool", "Tail": "Ollama"},
                {"Head": "Bob", "Relation": "usesTool", "Tail": "Ollama"},
                {"Head": "Alice", "Relation": "livesIn", "Tail": "Algiers"},
                {"Head": "Bob", "Relation": "livesIn", "Tail": "Oran"},
            ]
        )
        session = create_session_from_dataframe(
            dataset_name="Unit Test KG",
            source_type="upload",
            source_path=None,
            df=df,
            mapping={"Head": "Head", "Relation": "Relation", "Tail": "Tail"},
            holdout_mode=False,
        )
        candidates = ensure_candidates(session)
        self.assertGreaterEqual(candidates["summary"]["generated_count"], 2)

        filter_payload = run_filtering(session, enabled=False)
        self.assertFalse(filter_payload["enabled"])

        llm_payload = run_llm_validation(
            session,
            format_name="triples",
            strategy="zero",
            force_mock=True,
            use_filter_results=False,
            max_candidates=4,
        )
        self.assertIn("summary", llm_payload)

        completed = get_completed_payload(session)
        self.assertIn("summary", completed)
        self.assertGreaterEqual(completed["summary"]["completed_triples"], len(session.known_df))


if __name__ == "__main__":
    unittest.main()
