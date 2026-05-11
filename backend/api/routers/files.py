from fastapi import APIRouter, Query, HTTPException
from pathlib import Path
from typing import Optional
import json
import shlex
import os
from pydantic import BaseModel

from core.agents.registry import registry
from core.safety import ensure_allowed, backup_file

router = APIRouter(prefix="/files", tags=["files"])

SETTINGS_KEYS = {"global_settings", "project_settings"}


def _parse_hooks(content: str) -> list[dict]:
    """Flatten hooks from a settings.json into a list of structured entries."""
    try:
        data = json.loads(content)
        hooks_data = data.get("hooks", {})
    except Exception:
        return []

    result = []
    for event, hook_groups in hooks_data.items():
        if not isinstance(hook_groups, list):
            continue
        for group in hook_groups:
            matcher = group.get("matcher") if isinstance(group, dict) else None
            inner = group.get("hooks", []) if isinstance(group, dict) else []
            for hook in inner:
                if not isinstance(hook, dict):
                    continue
                cmd = hook.get("command", "")
                script_path = None
                script_exists = None
                try:
                    parts = shlex.split(cmd)
                    if parts and (parts[0].startswith("/") or parts[0].startswith("~")):
                        script_path = os.path.expanduser(parts[0])
                        script_exists = os.path.isfile(script_path)
                except Exception:
                    pass
                result.append({
                    "event": event,
                    "matcher": matcher,
                    "command": cmd,
                    "script_path": script_path,
                    "script_exists": script_exists,
                })
    return result


class WriteBody(BaseModel):
    path: str
    content: str
    backup: bool = True   # write a .bak.<ts> copy first if file exists


class DeleteBody(BaseModel):
    path: str


@router.get("/meta")
def file_meta(
    agent: str = Query(...),
    key: str = Query(...),
    project: Optional[str] = Query(None),
):
    ag = registry.get(agent)
    if not ag:
        raise HTTPException(status_code=404, detail=f"Agent '{agent}' not found")

    project_path = Path(project) if project else None
    file = ag.get_file(key, project_path)
    if not file:
        raise HTTPException(status_code=404, detail=f"File key '{key}' not found for agent '{agent}'")

    content = None
    if file.exists and file.kind == "file":
        content = ag.read_file_content(key, project_path)

    counterpart_path = None
    counterpart_exists = None
    spec = next((s for s in ag.config_file_specs if s.key == key), None)
    if spec and spec.counterpart_agent and spec.counterpart_key:
        counterpart_ag = registry.get(spec.counterpart_agent)
        if counterpart_ag:
            counterpart_file = counterpart_ag.get_file(spec.counterpart_key, project_path)
            if counterpart_file:
                counterpart_path = counterpart_file.path
                counterpart_exists = counterpart_file.exists

    parsed_hooks = None
    if spec and spec.key in SETTINGS_KEYS and content:
        parsed_hooks = _parse_hooks(content) or None

    return {
        "path": file.path,
        "exists": file.exists,
        "content": content,
        "purpose": file.purpose,
        "details": file.details,
        "counterpart_agent": spec.counterpart_agent if spec else None,
        "counterpart_path": counterpart_path,
        "counterpart_exists": counterpart_exists,
        "parsed_hooks": parsed_hooks,
    }


@router.get("/read")
def read_file(path: str = Query(...)):
    p = Path(path)
    if not p.exists():
        raise HTTPException(status_code=404, detail="File not found")
    if not p.is_file():
        raise HTTPException(status_code=400, detail="Path is a directory")
    try:
        content = p.read_text(encoding="utf-8")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    return {"path": str(p), "content": content}


@router.post("/write")
def write_file(body: WriteBody):
    p = Path(body.path).expanduser()
    try:
        ensure_allowed(p)
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))

    backup_path = None
    try:
        if body.backup and p.exists() and p.is_file():
            backup_path = backup_file(p)
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(body.content, encoding="utf-8")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    return {
        "path": str(p),
        "written": True,
        "backup_path": str(backup_path) if backup_path else None,
    }


@router.delete("/delete")
def delete_file(path: str = Query(...)):
    p = Path(path).expanduser()
    try:
        ensure_allowed(p)
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    if not p.exists():
        raise HTTPException(status_code=404, detail="File not found")
    if p.is_dir():
        raise HTTPException(status_code=400, detail="Path is a directory — use a targeted file path")
    backup_path = backup_file(p)
    try:
        p.unlink()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    return {
        "path": str(p),
        "deleted": True,
        "backup_path": str(backup_path) if backup_path else None,
    }
