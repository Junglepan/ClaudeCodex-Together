"""
CCT Backend — FastAPI
Serves local file data to the frontend. No network calls, read-only except sync writes.
"""

import os
import platform
import sys
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.routers import agents, files, sync

app = FastAPI(
    title="CCT Backend",
    description="Claude / Codex Configuration Manager — local file API",
    version="0.1.0",
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


# ── Core endpoints ───────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok", "version": "0.1.0"}


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

    # CCT_PROJECT env var lets callers specify the project root explicitly.
    # Falls back to the parent of the backend dir (repo root when run normally).
    project_path = os.environ.get("CCT_PROJECT")
    if not project_path:
        # backend/ lives inside the project root, go one level up
        backend_dir = Path(__file__).parent
        project_path = str(backend_dir.parent)

    return {
        "project_path": project_path,
        "home_path": str(Path.home()),
        "platform": platform_label,
        "hostname": node,
        "python_version": sys.version.split()[0],
    }
