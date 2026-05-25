"""Create benchmark sessions and print URLs for manual verification."""
from __future__ import annotations

import json
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO_ROOT))

from fastapi.testclient import TestClient

from backend.app.main import app

client = TestClient(app)
samples = client.get("/api/samples").json()
print("=== /api/samples ===")
for s in samples["samples"]:
    print(
        f"  {s['id']}: available={s['available']} "
        f"source_available={s.get('source_available')} "
        f"kg_loader_available={s.get('kg_loader_available')}"
    )

print()
results = {}
for sid in ["omnia_codex_m", "omnia_fb15k-237", "omnia_wn18rr"]:
    r = client.post(f"/api/sessions/sample/{sid}?holdout_mode=true&sample_proportion=0.8")
    print(f"=== POST sample/{sid} ===")
    print("status:", r.status_code)
    if r.status_code == 200:
        data = r.json()
        session_id = data.get("session_id", "")
        url = f"http://localhost:5173/paper-demo?sessionId={session_id}"
        results[sid] = {"session_id": session_id, "url": url}
        print("session_id:", session_id)
        print("url:", url)
    else:
        print(r.text[:400])
    print()

print("=== JSON summary ===")
print(json.dumps(results, indent=2))
