"""
Conservative writer for Codex target files.
Rules:
  - Never touches Claude source files
  - Skips existing files unless replace=True
  - dry_run=True returns plan without writing
"""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional


@dataclass
class WriteAction:
    target_path: Path
    content: str
    skipped: bool = False
    skip_reason: str = ""


@dataclass
class WriteReport:
    written: list[str] = field(default_factory=list)
    skipped: list[str] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)


# Directories that must never be written to (Claude source protection)
PROTECTED_PATTERNS = [
    ".claude/",
    "/.claude/",
]


def _is_protected(path: Path) -> bool:
    path_str = str(path)
    return any(pat in path_str for pat in PROTECTED_PATTERNS)


def write_files(
    actions: list[WriteAction],
    dry_run: bool = True,
    replace: bool = False,
) -> WriteReport:
    report = WriteReport()

    for action in actions:
        if _is_protected(action.target_path):
            report.errors.append(f"BLOCKED: {action.target_path} is a protected Claude source path")
            continue

        if action.target_path.exists() and not replace:
            report.skipped.append(str(action.target_path))
            continue

        if dry_run:
            report.written.append(f"[dry-run] {action.target_path}")
            continue

        try:
            action.target_path.parent.mkdir(parents=True, exist_ok=True)
            action.target_path.write_text(action.content, encoding="utf-8")
            report.written.append(str(action.target_path))
        except Exception as e:
            report.errors.append(f"{action.target_path}: {e}")

    return report


def make_skill_path(name: str, target_dir: Path) -> Path:
    safe_name = name.lower().replace(" ", "-")
    return target_dir / f"{safe_name}.md"


def make_agent_path(name: str, target_dir: Path) -> Path:
    safe_name = name.lower().replace(" ", "-")
    return target_dir / f"{safe_name}.md"
