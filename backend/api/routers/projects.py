"""
GET /projects — discover projects from Claude and Codex config stores.

Sources:
  1. ~/.codex/config.toml [projects.*] keys — real absolute paths, no decoding needed
  2. ~/.claude/projects/ subdirectory names — URL-encoded paths, decode via backtracking
"""

import os
import re
from pathlib import Path
from typing import Optional

from fastapi import APIRouter

router = APIRouter(prefix="/projects", tags=["projects"])


# ── Claude project path decoder ───────────────────────────────────────────────

def _decode_claude_project_dir(encoded: str) -> Optional[str]:
    """
    Recover the original filesystem path from a ~/.claude/projects/<name> entry.

    Claude encodes paths by replacing every '/' with '-'. Because '-' and '_'
    also appear in directory names, the mapping is ambiguous. We use backtracking:
    treat each '-' in the encoded string as a candidate for '/', '-', or '_',
    enumerate all combinations, and return the first that exists on disk.
    """
    # Split on '-' boundaries; each separator might be '/', '-', or '_'
    parts = re.split(r'(-)', encoded)
    # parts = ['seg0', '-', 'seg1', '-', 'seg2', ...]
    # Collect segment positions and separator positions separately
    segments: list[str] = []
    separators: list[str] = []
    for i, p in enumerate(parts):
        if i % 2 == 0:
            segments.append(p)
        else:
            separators.append(p)  # always '-' from the split

    n = len(separators)
    choices = ['/', '-', '_']

    def backtrack(idx: int, current: str) -> Optional[str]:
        if idx == n:
            candidate = current + segments[idx]
            return candidate if os.path.isdir(candidate) else None
        seg = segments[idx]
        for ch in choices:
            result = backtrack(idx + 1, current + seg + ch)
            if result is not None:
                return result
        return None

    if not segments:
        return None

    # The first segment of a Unix path is always empty (path starts with '/')
    # so encoded paths start with the part after the leading slash
    # Try treating the whole thing as path starting with '/'
    candidate = backtrack(0, '/')
    return candidate


# ── Codex project discovery ───────────────────────────────────────────────────

def _discover_from_codex(home: Path) -> list[dict]:
    config_path = home / ".codex" / "config.toml"
    if not config_path.exists():
        return []
    try:
        import tomllib
        with open(config_path, "rb") as f:
            data = tomllib.load(f)
    except Exception:
        return []

    projects_table = data.get("projects", {})
    results = []
    for path_key in projects_table:
        p = Path(path_key)
        results.append({
            "path": str(p),
            "name": p.name or str(p),
            "exists": p.is_dir(),
            "source": "codex",
        })
    return results


# ── Claude project discovery ──────────────────────────────────────────────────

def _discover_from_claude(home: Path) -> list[dict]:
    projects_dir = home / ".claude" / "projects"
    if not projects_dir.is_dir():
        return []

    results = []
    for entry in sorted(projects_dir.iterdir()):
        if not entry.is_dir():
            continue
        decoded = _decode_claude_project_dir(entry.name)
        if decoded:
            p = Path(decoded)
            results.append({
                "path": decoded,
                "name": p.name or decoded,
                "exists": p.is_dir(),
                "source": "claude",
            })
        # Skip entries we couldn't decode (deleted projects with ambiguous names)
    return results


# ── Merge and deduplicate ─────────────────────────────────────────────────────

def _merge(codex_list: list[dict], claude_list: list[dict]) -> list[dict]:
    seen: dict[str, dict] = {}

    def canonical(path: str) -> str:
        try:
            return os.path.realpath(path)
        except Exception:
            return path

    for item in codex_list + claude_list:
        key = canonical(item["path"])
        if key in seen:
            existing = seen[key]
            if existing["source"] != item["source"]:
                existing["source"] = "both"
        else:
            seen[key] = dict(item)

    # Sort: existing dirs first, then alphabetical by name
    return sorted(seen.values(), key=lambda x: (not x["exists"], x["name"].lower()))


# ── Route ─────────────────────────────────────────────────────────────────────

@router.get("")
def list_projects():
    """
    Returns discovered projects from ~/.codex/config.toml and ~/.claude/projects/.
    Each item: { path, name, exists, source }.
    """
    home = Path.home()
    codex = _discover_from_codex(home)
    claude = _discover_from_claude(home)
    return _merge(codex, claude)
