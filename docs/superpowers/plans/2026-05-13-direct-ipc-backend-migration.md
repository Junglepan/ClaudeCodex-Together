# Direct IPC Backend Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Python/FastAPI backend with direct Electron IPC filesystem services.

**Architecture:** Renderer calls `window.cct.api.*`; preload forwards to one `cct:api` IPC handler; Electron main dispatches to TypeScript backend modules. Python, HTTP, Vite proxy, CORS, and backend process spawning are removed.

**Tech Stack:** Electron IPC, TypeScript, Node `fs/path/os`, `smol-toml`, `jszip`, React.

---

## Task 1: Add Node Backend Dependencies And Tests

**Files:**
- Modify: `package.json`
- Create: `electron/backend/*.ts`
- Create: `electron/backend/*.test.ts`

- [ ] Add `smol-toml`, `jszip`, and a minimal TS test runner dependency if needed.
- [ ] Write failing tests for project merge/discovery and resolved config behavior equivalent to existing Python tests.
- [ ] Run the tests and confirm they fail because modules are missing.

## Task 2: Implement Core Node Backend

**Files:**
- Create: `electron/backend/fsUtils.ts`
- Create: `electron/backend/agents.ts`
- Create: `electron/backend/projects.ts`
- Create: `electron/backend/config.ts`
- Create: `electron/backend/files.ts`

- [ ] Port agent definitions from `backend/core/agents`.
- [ ] Implement file scanning, metadata, read/write/delete with safety checks.
- [ ] Implement project discovery and config resolution.
- [ ] Run Node backend tests until green.

## Task 3: Implement Sync And Backup

**Files:**
- Create: `electron/backend/sync.ts`
- Create: `electron/backend/backup.ts`
- Create: tests for sync planning and backup payload creation.

- [ ] Port scan/convert/write logic from Python.
- [ ] Implement backup export as a byte array returned over IPC.
- [ ] Verify tests pass.

## Task 4: Wire IPC

**Files:**
- Modify: `electron/preload.ts`
- Modify: `electron/main.ts`
- Create: `electron/backend/api.ts`
- Modify: `src/lib/electron-bridge.ts`
- Modify: `src/core/api.ts`
- Modify: direct fetch callers in `src/modules/path-mapping/PathMapping.tsx` and `src/modules/settings/Settings.tsx`.

- [ ] Add `window.cct.api(request)` in preload.
- [ ] Register `ipcMain.handle("cct:api", ...)` in main.
- [ ] Remove Python process spawn/start/stop code.
- [ ] Replace renderer `fetch` transport with IPC-only calls.
- [ ] Keep public `api.*` methods unchanged for callers.

## Task 5: Remove Python/HTTP Packaging

**Files:**
- Delete: `backend/`
- Delete: `requirements.txt`
- Modify: `package.json`
- Modify: `vite.config.ts`
- Modify: `.github/workflows/ci.yml`
- Modify: `.github/workflows/release.yml`
- Modify: `README.md`
- Modify: `scripts/assert-file-url-assets.mjs`

- [ ] Remove `dev:backend`, backend packaging, `asarUnpack` for backend, and Vite `/api` proxy.
- [ ] Remove Python setup/test steps from CI/release.
- [ ] Update docs to describe Electron IPC backend.
- [ ] Update packaging check to reject Python/HTTP backend references.

## Task 6: Verify

- [ ] Run `npm run type-check`.
- [ ] Run Node backend tests.
- [ ] Run `npm run build`.
- [ ] Launch packaged app and confirm overview renders online without port `8765`.
- [ ] Run `rg "uvicorn|FastAPI|127\\.0\\.0\\.1:8765|fetch\\('/api|fetch\\(\\\"/api|dev:backend"`.

## Self-Review

- Spec coverage: Covers direct IPC, no compatibility/fallback, module migration, packaging cleanup, and verification.
- Placeholder scan: No placeholders remain.
- Type consistency: IPC shape is centralized through `cct:api` and renderer API shapes remain unchanged.
