import json
from fastapi import APIRouter
from pathlib import Path
from pydantic import BaseModel
from typing import Optional, Literal

from core.scanner import scan_global, scan_project
from core.converter import convert_instructions, convert_skill, convert_agent
from core.writer import write_files, WriteAction, make_skill_path, make_agent_path

router = APIRouter(prefix="/sync", tags=["sync"])

UNSUPPORTED_HOOKS = {
    "SessionStart": "Codex 无对应事件，无法迁移。建议将相关行为记录在 AGENTS.md 中手动说明",
    "Stop": "Codex 无对应事件，无法迁移。建议将相关行为记录在 AGENTS.md 中手动说明",
    "Notification": "Codex 无对应事件，无法迁移",
}


class SyncRequest(BaseModel):
    scope: Literal["all", "global", "project"] = "all"
    project_path: Optional[str] = None
    dry_run: bool = True
    replace: bool = False


def _do_scan(scope: str, project_path: Optional[Path], home: Path):
    """Stage 1: scan only. Returns raw scan results per scope."""
    global_scan = None
    project_scan = None
    if scope in ("all", "global"):
        global_scan = scan_global(home)
    if scope in ("all", "project") and project_path:
        project_scan = scan_project(project_path)
    return global_scan, project_scan


def _scan_to_items(scan_result, is_global: bool, home: Path, project: Optional[Path]) -> list[dict]:
    """Serialize a ScanResult to scan-stage item dicts (no conversion yet)."""
    items = []
    for inst in scan_result.instructions:
        target = (home / ".codex" / "AGENTS.md") if is_global else ((project or Path.cwd()) / "AGENTS.md")
        items.append({
            "type": "Instruction",
            "name": inst.source_path.name,
            "source": str(inst.source_path),
            "target": str(target),
            "has_slash_commands": inst.has_slash_commands,
            "has_tool_references": inst.has_tool_references,
        })
    skills_target_dir = (home / ".codex" / "skills") if is_global else ((project or Path.cwd()) / ".codex" / "skills")
    for skill in scan_result.skills:
        items.append({
            "type": "Skill",
            "name": skill.name,
            "source": str(skill.source_path),
            "target": str(make_skill_path(skill.name, skills_target_dir)),
        })
    agents_target_dir = (home / ".codex" / "agents") if is_global else ((project or Path.cwd()) / ".codex" / "agents")
    for agent in scan_result.agents:
        items.append({
            "type": "Subagent",
            "name": agent.name,
            "source": str(agent.source_path),
            "target": str(make_agent_path(agent.name, agents_target_dir)),
        })
    for cmd in scan_result.commands:
        items.append({
            "type": "Command",
            "name": cmd.name,
            "source": str(cmd.source_path),
            "target": "",
            "status": "unsupported",
            "notes": "Codex 无等价斜杠命令机制，不迁移",
        })
    # Hooks from settings.json
    settings_path = (home / ".claude" / "settings.json") if is_global else (
        (project or Path.cwd()) / ".claude" / "settings.json"
    )
    if settings_path.exists():
        try:
            settings = json.loads(settings_path.read_text())
            for event in settings.get("hooks", {}):
                if event in UNSUPPORTED_HOOKS:
                    items.append({
                        "type": "Hook",
                        "name": event,
                        "source": str(settings_path),
                        "target": "",
                        "status": "unsupported",
                        "notes": UNSUPPORTED_HOOKS[event],
                    })
        except Exception:
            pass
    return items


def _build_plan(scope: str, project_path: Optional[Path], home: Path):
    """Stages 2+: scan + convert. Returns (items, actions) tuples."""
    items = []
    actions = []

    if scope in ("all", "global"):
        g = scan_global(home)
        _process_scan(g, items, actions, is_global=True, home=home, project=project_path)

    if scope in ("all", "project") and project_path:
        p = scan_project(project_path)
        _process_scan(p, items, actions, is_global=False, home=home, project=project_path)

    return items, actions


def _process_scan(scan, items, actions, is_global, home, project):
    # Instructions
    for inst in scan.instructions:
        result = convert_instructions(inst)
        target = (home / ".codex" / "AGENTS.md") if is_global else ((project or Path.cwd()) / "AGENTS.md")
        items.append({
            "status": result.status,
            "type": "Instruction",
            "name": inst.source_path.name,
            "source": str(inst.source_path),
            "target": str(target),
            "notes": result.notes,
            "warnings": result.warnings,
        })
        actions.append(WriteAction(target_path=target, content=result.content))

    # Skills — target: ~/.codex/skills/ (not ~/.agents/skills/)
    skills_target_dir = (home / ".codex" / "skills") if is_global else ((project or Path.cwd()) / ".codex" / "skills")
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
            "warnings": result.warnings,
        })
        actions.append(WriteAction(target_path=target, content=result.content))

    # Agents
    agents_target_dir = (home / ".codex" / "agents") if is_global else ((project or Path.cwd()) / ".codex" / "agents")
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
            "warnings": result.warnings,
        })
        actions.append(WriteAction(target_path=target, content=result.content))

    # Commands — always unsupported
    for cmd in scan.commands:
        items.append({
            "status": "unsupported",
            "type": "Command",
            "name": cmd.name,
            "source": str(cmd.source_path),
            "target": "",
            "notes": "Codex 无等价斜杠命令机制，不迁移",
            "warnings": [],
        })

    # Unsupported hooks from settings.json
    settings_path = (home / ".claude" / "settings.json") if is_global else (
        (project or Path.cwd()) / ".claude" / "settings.json"
    )
    # Exclude settings.local.json from sync
    settings_local = (project or Path.cwd()) / ".claude" / "settings.local.json" if not is_global else None
    if settings_local and settings_local.exists():
        items.append({
            "status": "unsupported",
            "type": "Settings",
            "name": "settings.local.json",
            "source": str(settings_local),
            "target": "",
            "notes": "本地覆盖文件不参与同步（含个人敏感配置）",
            "warnings": [],
        })

    if settings_path.exists():
        try:
            settings = json.loads(settings_path.read_text())
            for event in settings.get("hooks", {}):
                if event in UNSUPPORTED_HOOKS:
                    items.append({
                        "status": "unsupported",
                        "type": "Hook",
                        "name": event,
                        "source": str(settings_path),
                        "target": "",
                        "notes": UNSUPPORTED_HOOKS[event],
                        "warnings": [],
                    })
        except Exception:
            pass


# ── Stage 1: Scan only (pure read) ──────────────────────────────────────────

@router.post("/scan")
def sync_scan(req: SyncRequest):
    home = Path.home()
    project_path = Path(req.project_path) if req.project_path else None
    global_scan, project_scan = _do_scan(req.scope, project_path, home)

    items = []
    if global_scan:
        items.extend(_scan_to_items(global_scan, is_global=True, home=home, project=project_path))
    if project_scan:
        items.extend(_scan_to_items(project_scan, is_global=False, home=home, project=project_path))

    return {"items": items}


# ── Stage 2: Plan (scan + convert, no write) ─────────────────────────────────

@router.post("/plan")
def sync_plan(req: SyncRequest):
    home = Path.home()
    project_path = Path(req.project_path) if req.project_path else None
    items, _ = _build_plan(req.scope, project_path, home)

    added       = sum(1 for i in items if i["status"] == "added")
    check       = sum(1 for i in items if i["status"] == "check")
    unsupported = sum(1 for i in items if i["status"] == "unsupported")

    return {
        "items": items,
        "stats": {
            "migratable": added + check,
            "needs_conversion": check,
            "conflicts": 0,
            "unsupported": unsupported,
        },
    }


# ── Stage 3: Dry run (scan + convert + write dry_run=True) ───────────────────

@router.post("/dry-run")
def sync_dry_run(req: SyncRequest):
    home = Path.home()
    project_path = Path(req.project_path) if req.project_path else None
    items, actions = _build_plan(req.scope, project_path, home)

    report = write_files(actions, dry_run=True, replace=req.replace)

    # Annotate each item with would_write / would_skip
    action_targets = {str(a.target_path) for a in actions}
    for item in items:
        if item["target"] in report.written:
            item["dry_run_action"] = "would_write"
        elif item["target"] in report.skipped:
            item["dry_run_action"] = "would_skip"
        elif item["status"] == "unsupported":
            item["dry_run_action"] = "skip_unsupported"
        else:
            item["dry_run_action"] = "unknown"

    return {
        "dry_run": True,
        "items": items,
        "would_write": report.written,
        "would_skip": report.skipped,
    }


# ── Stage 4: Execute (scan + convert + write dry_run=False) ─────────────────

@router.post("/execute")
def sync_execute(req: SyncRequest):
    home = Path.home()
    project_path = Path(req.project_path) if req.project_path else None
    items, actions = _build_plan(req.scope, project_path, home)

    report = write_files(actions, dry_run=False, replace=req.replace)

    return {
        "dry_run": False,
        "items": items,
        "written": report.written,
        "skipped": report.skipped,
        "errors": report.errors,
    }
