"""
Path safety helpers — restrict writes/deletes to known config roots.
Reads are unrestricted (any path can be inspected).
"""

from __future__ import annotations

import os
import shutil
from datetime import datetime
from pathlib import Path
from typing import Iterable


def _allowed_roots() -> list[Path]:
    """Roots under which writes are permitted."""
    home = Path.home()
    roots = [
        home / ".claude",
        home / ".codex",
        home / ".agents",
        home / ".claude.json",                     # auth file (file, not dir)
        home / "AGENTS.md",                        # global codex instructions
    ]
    # Project root from env
    project = os.environ.get("CC_STEWARD_PROJECT") or os.environ.get("CCT_PROJECT")
    if project:
        roots.append(Path(project))
    # Plus the current working directory's parent (where backend was launched from)
    roots.append(Path(__file__).resolve().parent.parent.parent)
    return [r.resolve() for r in roots if r]


def is_path_allowed(path: Path, extra_roots: Iterable[Path] = ()) -> bool:
    p = path.resolve()
    roots = _allowed_roots() + [Path(r).resolve() for r in extra_roots]
    for root in roots:
        try:
            p.relative_to(root)
            return True
        except ValueError:
            continue
        # File-as-root match (single allowed file)
        if p == root:
            return True
    return False


def ensure_allowed(path: Path, extra_roots: Iterable[Path] = ()) -> None:
    """Raise PermissionError if path is outside allowed roots."""
    if not is_path_allowed(path, extra_roots):
        raise PermissionError(f"路径越权：{path} 不在允许的范围内（~/.claude/、~/.codex/、~/.agents/、当前项目）")


def backup_file(path: Path) -> Path | None:
    """Copy file to a sibling .bak.<timestamp> file. No-op if file does not exist."""
    if not path.exists() or not path.is_file():
        return None
    ts = datetime.now().strftime("%Y%m%d-%H%M%S")
    backup = path.with_suffix(path.suffix + f".bak.{ts}")
    shutil.copy2(path, backup)
    return backup
