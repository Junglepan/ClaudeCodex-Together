from fastapi import APIRouter, Query
from pathlib import Path
from typing import Optional

from core.agents.registry import registry
from core.agents.base import AgentSummary, ConfigFileResult

router = APIRouter(prefix="/agents", tags=["agents"])


@router.get("", response_model=list[dict])
def list_agents(project: Optional[str] = Query(None)):
    project_path = Path(project) if project else None
    return [
        {
            "id": a.id,
            "name": a.name,
            "status": a.summary(project_path).status,
            "global_path": a.summary(project_path).global_path,
            "file_count": a.summary(project_path).file_count,
        }
        for a in registry.all()
    ]


@router.get("/{agent_id}/files", response_model=list[dict])
def agent_files(agent_id: str, project: Optional[str] = Query(None)):
    agent = registry.get(agent_id)
    if not agent:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail=f"Agent '{agent_id}' not found")

    project_path = Path(project) if project else None
    files = agent.scan_files(project_path)

    return [
        {
            "key": f.key,
            "label": f.label,
            "path": f.path,
            "exists": f.exists,
            "scope": f.scope,
            "kind": f.kind,
            "format": f.format,
            "status": f.status,
            "size_bytes": f.size_bytes,
            "modified_at": f.modified_at,
            "purpose": f.purpose,
        }
        for f in files
    ]
