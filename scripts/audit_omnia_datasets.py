"""Audit OMNIA+ local dataset folders and report KEEP / DOWNLOAD / BACKUP actions.

Run standalone:
    python scripts/audit_omnia_datasets.py

Or import from setup_omnia_datasets.py.
"""

from __future__ import annotations

import json
import subprocess
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


REPO_ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = REPO_ROOT / "data"
OUTPUT_DIR = REPO_ROOT / "outputs" / "audits"

OFFICIAL_REMOTES = {
    "codex": "github.com/tsafavi/codex",
    "datasets_knowledge_embedding": "github.com/villmow/datasets_knowledge_embedding",
    "covidfact": "github.com/asaakyan/covidfact",
}

SPLIT_NAMES = ("train", "valid", "test", "dev")


@dataclass
class DatasetAudit:
    name: str
    status: str  # FOUND | MISSING | PARTIAL
    path: str
    git_remote: str | None = None
    git_ok: bool = False
    file_count: int = 0
    split_files: list[str] = field(default_factory=list)
    row_counts: dict[str, int] = field(default_factory=dict)
    total_rows: int = 0
    backend_usable: bool = False
    source_available: bool = False
    kg_loader_available: bool = False
    action: str = "KEEP"  # KEEP | DOWNLOAD | BACKUP_AND_REDOWNLOAD | NEEDS_CONVERTER
    notes: list[str] = field(default_factory=list)


def _run_git(args: list[str], cwd: Path) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        ["git", *args],
        cwd=str(cwd),
        capture_output=True,
        text=True,
        check=False,
    )


def _git_remote_url(repo_dir: Path) -> str | None:
    if not (repo_dir / ".git").exists():
        return None
    result = _run_git(["remote", "get-url", "origin"], repo_dir)
    if result.returncode != 0:
        return None
    return result.stdout.strip()


def _remote_matches(name: str, url: str | None) -> bool:
    if not url:
        return False
    expected = OFFICIAL_REMOTES.get(name, "")
    return expected.lower() in url.lower()


def _count_lines(path: Path) -> int:
    count = 0
    with path.open("rb") as handle:
        for _ in handle:
            count += 1
    return count


def _find_split_files(directory: Path) -> list[Path]:
    if not directory.exists():
        return []
    found: list[Path] = []
    for path in sorted(directory.rglob("*")):
        if not path.is_file():
            continue
        stem = path.stem.lower()
        if stem in SPLIT_NAMES and path.suffix.lower() in {".txt", ".tsv"}:
            found.append(path)
    return found


def _audit_codex() -> DatasetAudit:
    repo = DATA_DIR / "codex"
    triples_dir = repo / "data" / "triples" / "codex-m"
    remote = _git_remote_url(repo)
    git_ok = _remote_matches("codex", remote)
    splits = _find_split_files(triples_dir)
    row_counts = {p.stem: _count_lines(p) for p in splits if "negative" not in p.name.lower()}
    total = sum(row_counts.values())
    entities_dir = repo / "data" / "entities"
    relations_dir = repo / "data" / "relations"
    usable = git_ok and bool(splits) and total > 0

    audit = DatasetAudit(
        name="CoDEx-M",
        status="FOUND" if usable else ("PARTIAL" if repo.exists() else "MISSING"),
        path=str(triples_dir),
        git_remote=remote,
        git_ok=git_ok,
        file_count=len(list(triples_dir.glob("*"))) if triples_dir.exists() else 0,
        split_files=[p.name for p in splits],
        row_counts=row_counts,
        total_rows=total,
        backend_usable=usable,
        source_available=usable,
        kg_loader_available=usable,
        action="KEEP" if usable else ("BACKUP_AND_REDOWNLOAD" if repo.exists() else "DOWNLOAD"),
    )
    if entities_dir.exists():
        audit.notes.append(f"entities dir: {entities_dir}")
    if relations_dir.exists():
        audit.notes.append(f"relations dir: {relations_dir}")
    if not git_ok and repo.exists():
        audit.notes.append("Git remote does not match official tsafavi/codex")
    return audit


def _audit_kge_dataset(label: str, folder_names: list[str]) -> DatasetAudit:
    repo = DATA_DIR / "datasets_knowledge_embedding"
    remote = _git_remote_url(repo)
    git_ok = _remote_matches("datasets_knowledge_embedding", remote)
    dataset_dir: Path | None = None
    for name in folder_names:
        candidate = repo / name
        if candidate.exists():
            dataset_dir = candidate
            break
    if dataset_dir is None:
        dataset_dir = repo / folder_names[0]

    splits = _find_split_files(dataset_dir) if dataset_dir.exists() else []
    # Prefer top-level splits over nested duplicates (WN18RR has original/ subfolder).
    top_level = [p for p in splits if p.parent == dataset_dir]
    if top_level:
        splits = top_level
    row_counts = {p.stem: _count_lines(p) for p in splits}
    total = sum(row_counts.values())
    usable = git_ok and dataset_dir.exists() and bool(splits) and total > 0

    return DatasetAudit(
        name=label,
        status="FOUND" if usable else ("PARTIAL" if repo.exists() else "MISSING"),
        path=str(dataset_dir),
        git_remote=remote,
        git_ok=git_ok,
        file_count=len(list(dataset_dir.iterdir())) if dataset_dir.exists() else 0,
        split_files=[p.name for p in splits],
        row_counts=row_counts,
        total_rows=total,
        backend_usable=usable,
        source_available=usable,
        kg_loader_available=usable,
        action="KEEP" if usable else ("BACKUP_AND_REDOWNLOAD" if repo.exists() else "DOWNLOAD"),
    )


def _audit_covidfact() -> DatasetAudit:
    repo = DATA_DIR / "covidfact"
    jsonl = repo / "COVIDFACT_dataset.jsonl"
    remote = _git_remote_url(repo)
    git_ok = _remote_matches("covidfact", remote)
    jsonl_rows = _count_lines(jsonl) if jsonl.exists() else 0
    source_ok = git_ok and jsonl.exists() and jsonl_rows > 0
    # COVID-Fact JSONL is claim/evidence — not directly loadable as KG triples yet.
    kg_ok = False

    action = "KEEP" if source_ok else ("BACKUP_AND_REDOWNLOAD" if repo.exists() else "DOWNLOAD")
    if source_ok and not kg_ok:
        action = "NEEDS_CONVERTER"

    audit = DatasetAudit(
        name="COVID-Fact",
        status="FOUND" if source_ok else ("PARTIAL" if repo.exists() else "MISSING"),
        path=str(jsonl if jsonl.exists() else repo),
        git_remote=remote,
        git_ok=git_ok,
        file_count=1 if jsonl.exists() else 0,
        split_files=[jsonl.name] if jsonl.exists() else [],
        row_counts={"jsonl_claims": jsonl_rows} if jsonl_rows else {},
        total_rows=jsonl_rows,
        backend_usable=False,
        source_available=source_ok,
        kg_loader_available=kg_ok,
        action=action,
    )
    audit.notes.append(
        "COVIDFACT_dataset.jsonl is claim/evidence JSONL — not KG triples. "
        "Backend session creation requires a KG converter (not yet implemented)."
    )
    return audit


def run_audit() -> list[DatasetAudit]:
    return [
        _audit_codex(),
        _audit_kge_dataset("FB15K-237", ["FB15k-237", "FB15K-237", "fb15k-237"]),
        _audit_kge_dataset("WN18RR", ["WN18RR", "wn18rr"]),
        _audit_covidfact(),
    ]


def audits_to_markdown(audits: list[DatasetAudit], title: str = "OMNIA+ Dataset Audit Report") -> str:
    ts = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    lines = [
        f"# {title}",
        "",
        f"Generated: {ts}",
        "",
        f"Repository root: `{REPO_ROOT}`",
        "",
        "## Summary",
        "",
        "| Dataset | Status | Backend usable | Source available | KG loader | Action |",
        "| --- | --- | --- | --- | --- | --- |",
    ]
    for audit in audits:
        lines.append(
            f"| {audit.name} | {audit.status} | "
            f"{'yes' if audit.backend_usable else 'no'} | "
            f"{'yes' if audit.source_available else 'no'} | "
            f"{'yes' if audit.kg_loader_available else 'no'} | **{audit.action}** |"
        )
    lines.extend(["", "## Details", ""])
    for audit in audits:
        lines.extend(
            [
                f"### {audit.name}",
                "",
                f"- **Status:** {audit.status}",
                f"- **Path:** `{audit.path}`",
                f"- **Git remote:** `{audit.git_remote or 'n/a'}` ({'OK' if audit.git_ok else 'WRONG/MISSING'})",
                f"- **Files / splits:** {audit.file_count} files; splits: {', '.join(audit.split_files) or 'none'}",
                f"- **Row counts:** `{json.dumps(audit.row_counts)}` (total ≈ {audit.total_rows:,})",
                f"- **Recommended action:** **{audit.action}**",
            ]
        )
        for note in audit.notes:
            lines.append(f"- {note}")
        lines.append("")
    lines.extend(
        [
            "## Socio-Economic",
            "",
            "- **Status:** STATIC/DEMO-ONLY (private LLM-generated KG in OMNIA paper)",
            "- **Action:** Do not download — use frontend static config only.",
            "",
            "## OMNIA paper UI counts (display only)",
            "",
            "| Dataset | Entities | Relations | Triples |",
            "| --- | ---: | ---: | ---: |",
            "| CoDEx-M | 16,759 | 49 | 60,000 |",
            "| FB15K-237 | 12,993 | 29 | 59,270 |",
            "| WN18RR | 40,943 | 11 | 93,003 |",
            "| COVID-Fact | 1,416 | 28 | 908 |",
            "| Socio-Economic | 33,563 | 17,175 | 64,417 |",
            "",
        ]
    )
    return "\n".join(lines)


def write_audit_report(audits: list[DatasetAudit] | None = None) -> Path:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    audits = audits or run_audit()
    path = OUTPUT_DIR / "dataset_audit_report.md"
    path.write_text(audits_to_markdown(audits), encoding="utf-8")
    return path


def main() -> int:
    audits = run_audit()
    path = write_audit_report(audits)
    print(audits_to_markdown(audits))
    print(f"\nWrote: {path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
