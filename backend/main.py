"""
cc-steward Backend — FastAPI
Serves local file data to the frontend. No network calls, read-only except sync writes.
"""

import os
import platform
import sys
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.routers import agents, files, sync, backup, config, projects

app = FastAPI(
    title="cc-steward Backend",
    description="Claude / Codex Configuration Steward — local file API",
    version="1.0.2",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173", "http://127.0.0.1:5173",
        "http://localhost:5174", "http://127.0.0.1:5174",
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ──────────────────────────────────────────────────────────────────
app.include_router(agents.router)
app.include_router(files.router)
app.include_router(sync.router)
app.include_router(backup.router)
app.include_router(config.router)
app.include_router(projects.router)


# ── Core endpoints ───────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok", "version": "1.0.2"}


@app.get("/meta")
def meta():
    """Returns environment context for the frontend."""
    system = platform.system()
    node = platform.node()

    platform_label = {
        "Darwin": f"macOS {platform.mac_ver()[0]}",
        "Linux": f"Linux {platform.release()}",
        "Windows": f"Windows {platform.release()}",
    }.get(system, system)

    # CC_STEWARD_PROJECT env var lets callers specify the project root explicitly.
    # Legacy CCT_PROJECT still accepted. Returns null when no env var is set so
    # the frontend keeps projectPath undefined and ProjectSelector shows "未选择项目".
    project_path = os.environ.get("CC_STEWARD_PROJECT") or os.environ.get("CCT_PROJECT") or None

    return {
        "project_path": project_path,
        "home_path": str(Path.home()),
        "platform": platform_label,
        "hostname": node,
        "python_version": sys.version.split()[0],
    }
