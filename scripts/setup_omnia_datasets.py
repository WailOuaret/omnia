"""One-command OMNIA+ dataset setup: audit, backup, clone, pull, verify.

Safe by design:
- Never permanently deletes dataset folders.
- Wrong/incomplete repos are moved to data/_backup/<name>_backup_YYYYMMDD_HHMMSS.

Usage:
    python scripts/setup_omnia_datasets.py
"""

from __future__ import annotations

import json
import shutil
import subprocess
import sys
from datetime import datetime
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = REPO_ROOT / "data"
BACKUP_DIR = DATA_DIR / "_backup"
OUTPUT_DIR = REPO_ROOT / "outputs" / "audits"

# Allow importing audit module when run as script.
sys.path.insert(0, str(REPO_ROOT / "scripts"))
from audit_omnia_datasets import (  # noqa: E402
    DatasetAudit,
    audits_to_markdown,
    run_audit,
    write_audit_report,
)

REPOS = [
    {
        "folder": "codex",
        "url": "https://github.com/tsafavi/codex.git",
        "remote_key": "codex",
        "audit_names": {"CoDEx-M"},
    },
    {
        "folder": "datasets_knowledge_embedding",
        "url": "https://github.com/villmow/datasets_knowledge_embedding.git",
        "remote_key": "datasets_knowledge_embedding",
        "audit_names": {"FB15K-237", "WN18RR"},
    },
    {
        "folder": "covidfact",
        "url": "https://github.com/asaakyan/covidfact.git",
        "remote_key": "covidfact",
        "audit_names": {"COVID-Fact"},
    },
]


def _timestamp() -> str:
    return datetime.now().strftime("%Y%m%d_%H%M%S")


def _run(cmd: list[str], *, cwd: Path | None = None) -> subprocess.CompletedProcess[str]:
    print(f"  $ {' '.join(cmd)}")
    return subprocess.run(cmd, cwd=str(cwd) if cwd else None, capture_output=True, text=True, check=False)


def _git_remote_ok(repo_dir: Path, remote_key: str) -> bool:
    if not (repo_dir / ".git").exists():
        return False
    result = _run(["git", "remote", "get-url", "origin"], cwd=repo_dir)
    if result.returncode != 0:
        return False
    from audit_omnia_datasets import OFFICIAL_REMOTES

    return OFFICIAL_REMOTES[remote_key].lower() in result.stdout.strip().lower()


def _backup_repo(repo_dir: Path, folder_name: str) -> Path:
    BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    dest = BACKUP_DIR / f"{folder_name}_backup_{_timestamp()}"
    print(f"[backup] Moving {repo_dir} -> {dest}")
    shutil.move(str(repo_dir), str(dest))
    return dest


def _clone_repo(url: str, dest: Path) -> None:
    print(f"[clone] {url} -> {dest}")
    dest.parent.mkdir(parents=True, exist_ok=True)
    result = _run(["git", "clone", url, str(dest)])
    if result.returncode != 0:
        raise RuntimeError(f"git clone failed:\n{result.stderr}")


def _pull_repo(repo_dir: Path) -> None:
    print(f"[pull] {repo_dir}")
    result = _run(["git", "pull", "--ff-only"], cwd=repo_dir)
    if result.returncode != 0:
        print(f"  warning: git pull failed: {result.stderr.strip()}")


def _ensure_repos(pre_audit: list[DatasetAudit]) -> list[str]:
    actions: list[str] = []
    audit_by_name = {a.name: a for a in pre_audit}

    for spec in REPOS:
        folder = spec["folder"]
        repo_dir = DATA_DIR / folder
        related = [audit_by_name[n] for n in spec["audit_names"] if n in audit_by_name]
        needs_backup = any(a.action == "BACKUP_AND_REDOWNLOAD" for a in related)
        needs_download = any(a.action == "DOWNLOAD" for a in related) or not repo_dir.exists()

        if repo_dir.exists() and not _git_remote_ok(repo_dir, spec["remote_key"]):
            print(f"[check] Wrong git remote for {folder}")
            needs_backup = True

        if needs_backup and repo_dir.exists():
            backup_path = _backup_repo(repo_dir, folder)
            actions.append(f"Backed up {folder} to {backup_path}")
            needs_download = True

        if needs_download:
            if repo_dir.exists():
                print(f"[skip clone] {repo_dir} still exists after backup decision")
            else:
                _clone_repo(spec["url"], repo_dir)
                actions.append(f"Cloned {folder} from {spec['url']}")
        elif repo_dir.exists() and _git_remote_ok(repo_dir, spec["remote_key"]):
            _pull_repo(repo_dir)
            actions.append(f"Pulled latest {folder}")

    return actions


def _backend_samples() -> list[dict]:
    try:
        if str(REPO_ROOT) not in sys.path:
            sys.path.insert(0, str(REPO_ROOT))
        from backend.app.services import ingestion

        return ingestion.list_samples()
    except Exception as exc:  # noqa: BLE001
        return [{"error": str(exc)}]


def _write_setup_report(
    pre_audit: list[DatasetAudit],
    post_audit: list[DatasetAudit],
    repo_actions: list[str],
    samples: list[dict],
) -> Path:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    path = OUTPUT_DIR / "dataset_setup_report.md"
    lines = [
        "# OMNIA+ Dataset Setup Report",
        "",
        f"Generated: {datetime.now().isoformat(timespec='seconds')}",
        "",
        "## Repository actions",
        "",
    ]
    if repo_actions:
        lines.extend(f"- {action}" for action in repo_actions)
    else:
        lines.append("- No clone/backup actions required.")
    lines.extend(["", "## Before setup", ""])
    lines.append(audits_to_markdown(pre_audit, title="Pre-setup audit"))
    lines.extend(["", "## After setup", ""])
    lines.append(audits_to_markdown(post_audit, title="Post-setup audit"))
    lines.extend(["", "## Backend /api/samples", "", "```json"])
    lines.append(json.dumps(samples, indent=2))
    lines.extend(["```", ""])
    path.write_text("\n".join(lines), encoding="utf-8")
    return path


def main() -> int:
    print("=== OMNIA+ Dataset Setup ===\n")
    DATA_DIR.mkdir(exist_ok=True)
    BACKUP_DIR.mkdir(exist_ok=True)

    print("Phase 1 — Pre-setup audit")
    pre_audit = run_audit()
    write_audit_report(pre_audit)

    print("\nPhase 2-4 — Ensure repos (keep / backup / clone / pull)")
    repo_actions = _ensure_repos(pre_audit)

    print("\nPhase 5 — Post-setup audit")
    post_audit = run_audit()
    audit_path = write_audit_report(post_audit)

    print("\nPhase 6 — Backend sample discovery")
    samples = _backend_samples()
    setup_path = _write_setup_report(pre_audit, post_audit, repo_actions, samples)

    print("\n=== Final status ===")
    for audit in post_audit:
        print(
            f"  {audit.name:12} status={audit.status:8} "
            f"backend={audit.backend_usable} source={audit.source_available} "
            f"kg_loader={audit.kg_loader_available} action={audit.action}"
        )

    required = {"omnia_codex_m", "omnia_fb15k-237", "omnia_wn18rr"}
    available_ids = {s.get("id") for s in samples if s.get("available")}
    missing = required - available_ids
    if missing:
        print(f"\nWARNING: backend still missing available samples: {sorted(missing)}")
        for sample in samples:
            if sample.get("id") in missing:
                print(f"  {sample.get('id')}: {sample.get('load_error')}")
    else:
        print("\nOK: CoDEx-M, FB15K-237, and WN18RR are available via /api/samples")

    covid = next((s for s in samples if s.get("id") == "omnia_covid_fact"), None)
    if covid:
        print(
            f"\nCOVID-Fact: source_available={covid.get('source_available')} "
            f"kg_loader_available={covid.get('kg_loader_available')} "
            f"available={covid.get('available')}"
        )

    print(f"\nReports written:")
    print(f"  {audit_path}")
    print(f"  {setup_path}")
    return 1 if missing else 0


if __name__ == "__main__":
    raise SystemExit(main())
