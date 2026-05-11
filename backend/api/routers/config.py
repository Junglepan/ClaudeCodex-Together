"""
GET /config/resolved — compute the merged effective configuration state for an agent.
Returns per-dimension resolved state: settings layers, instruction load order,
skills/agents scope. First version only; complex nesting kept intentionally simple.
"""

import json
import os
from fastapi import APIRouter, Query, HTTPException
from pathlib import Path
from typing import Optional

from core.agents.registry import registry

router = APIRouter(prefix="/config", tags=["config"])


def _read_json_safe(path: Path) -> dict:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return {}


def _dir_entries(path: Path) -> list[str]:
    """List top-level names in a directory, or empty list if not present."""
    if not path.is_dir():
        return []
    return sorted(p.name for p in path.iterdir())


@router.get("/resolved")
def config_resolved(
    agent: str = Query(...),
    project: Optional[str] = Query(None),
):
    ag = registry.get(agent)
    if not ag:
        raise HTTPException(status_code=404, detail=f"Agent '{agent}' not found")

    home = Path.home()
    project_path = Path(project) if project else None

    if agent == "claude":
        return _resolve_claude(home, project_path)
    elif agent == "codex":
        return _resolve_codex(home, project_path)
    else:
        raise HTTPException(status_code=400, detail=f"Resolved config not supported for agent '{agent}'")


# ── Claude resolver ────────────────────────────────────────────────────────────

def _resolve_claude(home: Path, project: Optional[Path]):
    global_settings_path  = home / ".claude" / "settings.json"
    project_settings_path = (project / ".claude" / "settings.json") if project else None
    local_settings_path   = (project / ".claude" / "settings.local.json") if project else None

    # Merge settings: global → project → local (last wins per key)
    global_data  = _read_json_safe(global_settings_path)  if global_settings_path.exists()  else {}
    project_data = _read_json_safe(project_settings_path) if project_settings_path and project_settings_path.exists() else {}
    local_data   = _read_json_safe(local_settings_path)   if local_settings_path   and local_settings_path.exists()   else {}

    settings_rows = []
    all_keys = set(global_data) | set(project_data) | set(local_data)
    for key in sorted(all_keys):
        sources = []
        value   = None
        if key in global_data:  sources.append("global");        value = global_data[key]
        if key in project_data: sources.append("project");       value = project_data[key]
        if key in local_data:   sources.append("local_override"); value = local_data[key]
        top_source = sources[-1] if sources else "global"
        overrides  = sources[:-1] if len(sources) > 1 else []
        val_str = json.dumps(value, ensure_ascii=False)
        if len(val_str) > 80:
            val_str = val_str[:77] + "…"
        settings_rows.append({
            "key":       key,
            "value":     val_str,
            "source":    top_source,
            "overrides": overrides,
        })

    # CLAUDE.md load order
    instructions = []
    global_md = home / ".claude" / "CLAUDE.md"
    instructions.append({
        "path":   str(global_md),
        "exists": global_md.exists(),
        "order":  1,
        "scope":  "global",
    })
    if project:
        proj_md = project / "CLAUDE.md"
        instructions.append({
            "path":   str(proj_md),
            "exists": proj_md.exists(),
            "order":  2,
            "scope":  "project",
        })

    # Skills
    global_skills_dir  = home / ".claude" / "skills"
    project_skills_dir = (project / ".claude" / "skills") if project else None
    global_skill_names  = set(_dir_entries(global_skills_dir))
    project_skill_names = set(_dir_entries(project_skills_dir)) if project_skills_dir else set()
    skills = []
    for name in sorted(global_skill_names):
        skills.append({"name": name, "source": "global",  "overridden_by": "project" if name in project_skill_names else None})
    for name in sorted(project_skill_names - global_skill_names):
        skills.append({"name": name, "source": "project", "overridden_by": None})

    # Agents
    global_agents_dir  = home / ".claude" / "agents"
    project_agents_dir = (project / ".claude" / "agents") if project else None
    global_agent_names  = {p[:-3] for p in _dir_entries(global_agents_dir) if p.endswith(".md")}
    project_agent_names = {p[:-3] for p in _dir_entries(project_agents_dir) if p.endswith(".md")} if project_agents_dir else set()
    agents_list = []
    for name in sorted(global_agent_names):
        agents_list.append({"name": name, "source": "global", "overridden_by": "project" if name in project_agent_names else None})
    for name in sorted(project_agent_names - global_agent_names):
        agents_list.append({"name": name, "source": "project", "overridden_by": None})

    return {
        "agent": "claude",
        "project": str(project) if project else None,
        "settings": settings_rows,
        "instructions": instructions,
        "skills": skills,
        "agents": agents_list,
    }


# ── Codex resolver ─────────────────────────────────────────────────────────────

def _resolve_codex(home: Path, project: Optional[Path]):
    import tomllib  # Python 3.11+

    def read_toml(path: Path) -> dict:
        if not path.exists():
            return {}
        try:
            with open(path, "rb") as f:
                return tomllib.load(f)
        except Exception:
            return {}

    global_config_path  = home / ".codex" / "config.toml"
    project_config_path = (project / ".codex" / "config.toml") if project else None

    global_data  = read_toml(global_config_path)
    project_data = read_toml(project_config_path) if project_config_path else {}

    settings_rows = []
    for key in sorted(set(global_data) | set(project_data)):
        if key in ("mcp_servers", "features", "projects"):
            continue  # skip nested tables for first version
        sources = []
        value   = None
        if key in global_data:  sources.append("global");  value = global_data[key]
        if key in project_data: sources.append("project"); value = project_data[key]
        top_source = sources[-1] if sources else "global"
        overrides  = sources[:-1] if len(sources) > 1 else []
        val_str = str(value)
        if len(val_str) > 80:
            val_str = val_str[:77] + "…"
        settings_rows.append({
            "key":       key,
            "value":     val_str,
            "source":    top_source,
            "overrides": overrides,
        })

    # AGENTS.md load order
    instructions = []
    global_md = home / ".codex" / "AGENTS.md"
    instructions.append({
        "path":   str(global_md),
        "exists": global_md.exists(),
        "order":  1,
        "scope":  "global",
    })
    if project:
        proj_md = project / "AGENTS.md"
        instructions.append({
            "path":   str(proj_md),
            "exists": proj_md.exists(),
            "order":  2,
            "scope":  "project",
        })

    # Skills
    global_skills_dir  = home / ".codex" / "skills"
    project_skills_dir = (project / ".codex" / "skills") if project else None
    global_skill_names  = set(_dir_entries(global_skills_dir))
    project_skill_names = set(_dir_entries(project_skills_dir)) if project_skills_dir else set()
    skills = []
    for name in sorted(global_skill_names):
        skills.append({"name": name, "source": "global",  "overridden_by": "project" if name in project_skill_names else None})
    for name in sorted(project_skill_names - global_skill_names):
        skills.append({"name": name, "source": "project", "overridden_by": None})

    # Agents
    global_agents_dir  = home / ".codex" / "agents"
    project_agents_dir = (project / ".codex" / "agents") if project else None
    global_agent_names  = {p[:-3] for p in _dir_entries(global_agents_dir) if p.endswith(".md")}
    project_agent_names = {p[:-3] for p in _dir_entries(project_agents_dir) if p.endswith(".md")} if project_agents_dir else set()
    agents_list = []
    for name in sorted(global_agent_names):
        agents_list.append({"name": name, "source": "global", "overridden_by": "project" if name in project_agent_names else None})
    for name in sorted(project_agent_names - global_agent_names):
        agents_list.append({"name": name, "source": "project", "overridden_by": None})

    return {
        "agent": "codex",
        "project": str(project) if project else None,
        "settings": settings_rows,
        "instructions": instructions,
        "skills": skills,
        "agents": agents_list,
    }
