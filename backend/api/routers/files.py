from fastapi import APIRouter, Query, HTTPException
from pathlib import Path
from typing import Optional

from core.agents.registry import registry

router = APIRouter(prefix="/files", tags=["files"])


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

    # Find counterpart info
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

    return {
        "path": file.path,
        "exists": file.exists,
        "content": content,
        "purpose": file.purpose,
        "details": file.details,
        "counterpart_agent": spec.counterpart_agent if spec else None,
        "counterpart_path": counterpart_path,
        "counterpart_exists": counterpart_exists,
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
