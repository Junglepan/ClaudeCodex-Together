"""
Backup & export — bundle current Claude/Codex configs into a single archive.
"""

import io
import zipfile
from datetime import datetime
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Query
from fastapi.responses import StreamingResponse

from core.agents.registry import registry

router = APIRouter(prefix="/backup", tags=["backup"])


@router.get("/export")
def export_zip(project: Optional[str] = Query(None)):
    """Stream a zip archive containing all *existing* files declared by registered agents."""
    project_path = Path(project) if project else None
    buf = io.BytesIO()

    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        manifest_lines = [
            "# CCT Backup",
            f"created_at: {datetime.now().isoformat(timespec='seconds')}",
            f"project: {project_path or '-'}",
            "",
        ]
        for agent in registry.all():
            for f in agent.scan_files(project_path):
                if not f.exists:
                    continue
                src = Path(f.path)
                arc_root = f"{agent.id}/" + ("global" if f.scope == "global" else "project")
                if src.is_file():
                    arc_name = f"{arc_root}/{f.key}__{src.name}"
                    try:
                        zf.write(src, arc_name)
                        manifest_lines.append(f"{arc_name} <- {src}")
                    except Exception as e:
                        manifest_lines.append(f"# skip {src}: {e}")
                elif src.is_dir():
                    for child in src.rglob("*"):
                        if child.is_file():
                            rel = child.relative_to(src)
                            arc_name = f"{arc_root}/{f.key}/{rel}"
                            try:
                                zf.write(child, arc_name)
                                manifest_lines.append(f"{arc_name} <- {child}")
                            except Exception as e:
                                manifest_lines.append(f"# skip {child}: {e}")

        zf.writestr("MANIFEST.txt", "\n".join(manifest_lines))

    buf.seek(0)
    filename = f"cct-backup-{datetime.now().strftime('%Y%m%d-%H%M%S')}.zip"
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
