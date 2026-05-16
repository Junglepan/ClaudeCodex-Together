# Direct IPC Backend Migration Design

## Goal

Remove the Python/FastAPI backend and replace it with Electron main-process IPC handlers that operate directly on the local filesystem.

## Non-Goals

- No Python runtime packaging.
- No FastAPI, uvicorn, localhost HTTP server, Vite proxy, CORS, or HTTP fallback.
- No dual backend compatibility layer.
- No broad UI redesign.

## Architecture

The renderer calls `window.cct.api.*` through `preload.ts`. The preload forwards calls through `ipcRenderer.invoke("cct:api", request)`. Electron main registers one API handler that dispatches to TypeScript backend modules under `electron/backend/`.

All returned payloads keep the current `src/core/api.ts` TypeScript shapes so React modules stay mostly unchanged.

## Modules

- `electron/backend/types.ts`: shared request/response and domain types.
- `electron/backend/fsUtils.ts`: path, JSON, TOML, directory, backup, and safety helpers.
- `electron/backend/agents.ts`: Claude/Codex agent definitions and file scanning.
- `electron/backend/projects.ts`: Claude/Codex project discovery.
- `electron/backend/config.ts`: resolved config logic.
- `electron/backend/files.ts`: file meta/read/write/delete and hook parsing.
- `electron/backend/sync.ts`: Claude-to-Codex scan/plan/dry-run/execute.
- `electron/backend/backup.ts`: backup archive export payload.
- `electron/backend/api.ts`: IPC request dispatcher.

## Renderer API

`src/core/api.ts` no longer uses `fetch`. Every API method calls `electronApi.backend(...)`. Running in a normal browser is unsupported for app data because this is an Electron desktop app.

Direct `fetch("/api/...")` calls are removed.

## Build And Release

Remove backend packaging and Python checks from npm scripts and GitHub Actions. Electron packages only Node/renderer/main-process code and Node dependencies.

## Acceptance Criteria

- `npm run type-check` passes.
- Node backend tests pass.
- `npm run build` succeeds without Python.
- Packaged app starts without spawning Python or opening port `8765`.
- The overview screen shows backend/API online through IPC.
- No source code references `uvicorn`, `FastAPI`, `127.0.0.1:8765`, or `/api` fetch remain outside historical docs.
