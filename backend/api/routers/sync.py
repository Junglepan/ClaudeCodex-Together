from fastapi import APIRouter
from pathlib import Path
from pydantic import BaseModel
from typing import Optional, Literal

from core.scanner import scan_global, scan_project
from core.converter import convert_instructions, convert_skill, convert_agent
from core.writer import write_files, WriteAction, make_skill_path, make_agent_path

router = APIRouter(prefix="/sync", tags=["sync"])

# Hook events that cannot be migrated
UNSUPPORTED_HOOKS = {
    "SessionStart": "No Codex equivalent; document behavior in AGENTS.md manually",
    "Stop": "No Codex equivalent; document behavior in AGENTS.md manually",
    "Notification": "No Codex equivalent",
}


class SyncRequest(BaseModel):
    scope: Literal["all", "global", "project"] = "all"
    project_path: Optional[str] = None
    dry_run: bool = True
    replace: bool = False


def _build_plan(scope: str, project_path: Optional[Path], home: Path):
    """Scan Claude artifacts and build list of (item_info, WriteAction) tuples."""
    items = []
    actions = []

    if scope in ("all", "global"):
        g = scan_global(home)
        _process_scan(g, items, actions, home, is_global=True, home=home, project=project_path)

    if scope in ("all", "project") and project_path:
        p = scan_project(project_path)
        _process_scan(p, items, actions, project_path, is_global=False, home=home, project=project_path)

    return items, actions


def _process_scan(scan, items, actions, base_dir, is_global, home, project):
    # Instructions
    for inst in scan.instructions:
        result = convert_instructions(inst)
        if is_global:
            target = home / "AGENTS.md"
        else:
            target = (project or Path.cwd()) / "AGENTS.md"

        items.append({
            "status": result.status,
            "type": "Instruction",
            "name": inst.source_path.name,
            "source": str(inst.source_path),
            "target": str(target),
            "notes": result.notes,
        })
        actions.append(WriteAction(target_path=target, content=result.content))

    # Skills
    if is_global:
        skills_target_dir = home / ".agents" / "skills"
    else:
        skills_target_dir = (project or Path.cwd()) / ".agents" / "skills"

    for skill in scan.skills:
        result = convert_skill(skill)
        target = make_skill_path(skill.name, skills_target_dir)
        items.append({
            "status": result.status,
            "type": "Skill",
            "name": skill.name,
            "source": str(skill.source_path),
            "target": str(target),
            "notes": result.notes,
        })
        actions.append(WriteAction(target_path=target, content=result.content))

    # Agents
    if is_global:
        agents_target_dir = home / ".codex" / "agents"
    else:
        agents_target_dir = (project or Path.cwd()) / ".codex" / "agents"

    for agent in scan.agents:
        result = convert_agent(agent)
        target = make_agent_path(agent.name, agents_target_dir)
        items.append({
            "status": result.status,
            "type": "Subagent",
            "name": agent.name,
            "source": str(agent.source_path),
            "target": str(target),
            "notes": result.notes,
        })
        actions.append(WriteAction(target_path=target, content=result.content))

    # Report unsupported hooks from Claude settings
    import json
    settings_path = base_dir / ".claude" / "settings.json" if not is_global else Path.home() / ".claude" / "settings.json"
    if settings_path.exists():
        try:
            settings = json.loads(settings_path.read_text())
            for event in settings.get("hooks", {}):
                if event in UNSUPPORTED_HOOKS:
                    items.append({
                        "status": "not_added",
                        "type": "Hook",
                        "name": event,
                        "source": str(settings_path),
                        "target": "",
                        "notes": UNSUPPORTED_HOOKS[event],
                    })
        except Exception:
            pass


@router.post("/plan")
def sync_plan(req: SyncRequest):
    home = Path.home()
    project_path = Path(req.project_path) if req.project_path else None
    items, _ = _build_plan(req.scope, project_path, home)

    added = sum(1 for i in items if i["status"] == "added")
    check = sum(1 for i in items if i["status"] == "check")
    not_added = sum(1 for i in items if i["status"] == "not_added")

    return {
        "items": items,
        "stats": {
            "migratable": added + check,
            "needs_conversion": check,
            "conflicts": 0,
            "ignored": not_added,
        },
    }


@router.post("/execute")
def sync_execute(req: SyncRequest):
    home = Path.home()
    project_path = Path(req.project_path) if req.project_path else None
    items, actions = _build_plan(req.scope, project_path, home)

    report = write_files(actions, dry_run=req.dry_run, replace=req.replace)

    return {
        "dry_run": req.dry_run,
        "items": items,
        "written": report.written,
        "skipped": report.skipped,
        "errors": report.errors,
    }
