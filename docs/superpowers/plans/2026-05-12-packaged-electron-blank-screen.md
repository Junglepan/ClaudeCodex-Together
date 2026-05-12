# Packaged Electron Blank Screen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix packaged Electron startup so the installed app displays the React client and prove it with automated checks.

**Architecture:** Validate the production renderer, Electron main/preload output, and backend startup as separate layers, then add a production smoke check around the built Electron entry. Keep fixes scoped to the failing layer.

**Tech Stack:** React 18, Vite 6, Electron 33, electron-builder, TypeScript, Python FastAPI, pytest.

---

## File Structure

- Modify `vite.config.ts` if production asset paths are absolute and fail under `file://`.
- Modify `electron/main.ts` if the production renderer, preload, or backend paths are wrong.
- Modify `package.json` if scripts need a reusable smoke check command.
- Create `scripts/electron-smoke.mjs` if a production launch smoke test is needed.
- Modify focused tests or add script-level assertions only where they directly reproduce the blank screen.

## Task 1: Establish Current Failure

- [ ] **Step 1: Run TypeScript check**

Run: `npm run type-check`

Expected: Either PASS or a concrete compiler error to fix before production launch.

- [ ] **Step 2: Build renderer**

Run: `npm run build:frontend`

Expected: `dist/index.html` and bundled assets are created.

- [ ] **Step 3: Build Electron entry**

Run: `npm run build:electron`

Expected: `dist-electron/main.js`, `dist-electron/preload.js`, and `dist-electron/package.json` exist.

- [ ] **Step 4: Inspect production HTML asset references**

Run: `sed -n '1,120p' dist/index.html`

Expected: Script and stylesheet references work from `file://`. If they begin with `/assets/`, fix Vite production base.

- [ ] **Step 5: Launch production Electron entry with logs**

Run: `NODE_ENV=production npx electron dist-electron/main.js`

Expected: The app window renders visible content. If it is blank, capture terminal output and identify whether main, preload, backend, or renderer failed.

## Task 2: Add Minimal Regression Coverage

- [ ] **Step 1: Add a production smoke script if no existing check covers this**

Create `scripts/electron-smoke.mjs` that builds on Playwright or Electron process launch only if the repository already has the required dependency available. The script must fail when the renderer does not reach a nonblank DOM state.

- [ ] **Step 2: Add package script**

Modify `package.json` scripts with `"smoke:electron": "node scripts/electron-smoke.mjs"` if the smoke script is added.

- [ ] **Step 3: Run smoke check and confirm it fails before the fix**

Run: `npm run smoke:electron`

Expected: FAIL on the current blank-screen behavior, or PASS if the static inspection already identified a deterministic build-path issue and the script validates the corrected state after implementation.

## Task 3: Fix Root Cause

- [ ] **Step 1: Fix renderer asset base if needed**

If `dist/index.html` uses absolute `/assets/...` paths, set `base: './'` in `vite.config.ts`.

- [ ] **Step 2: Fix Electron production loading if needed**

If `mainWindow.loadURL(file://...)` points to a fragile or invalid path, switch production loading to `mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))` and keep dev loading on the Vite server.

- [ ] **Step 3: Fix packaged backend path if needed**

If packaged backend startup fails because Electron expects `process.resourcesPath/backend` but builder places files elsewhere, adjust `package.json` builder config or `electron/main.ts` path resolution so production backend files are included and discoverable.

- [ ] **Step 4: Make renderer startup failure visible if needed**

If the renderer throws before painting, add minimal error reporting or fallback UI at the app entry point so failures do not leave a silent blank window.

## Task 4: Verify End To End

- [ ] **Step 1: Run TypeScript check**

Run: `npm run type-check`

Expected: PASS.

- [ ] **Step 2: Run frontend build**

Run: `npm run build:frontend`

Expected: PASS.

- [ ] **Step 3: Run Electron build**

Run: `npm run build:electron`

Expected: PASS.

- [ ] **Step 4: Run backend tests**

Run: `cd backend && python3 -m pytest`

Expected: PASS, or document missing environment/dependency blocker.

- [ ] **Step 5: Run production Electron smoke check**

Run: `npm run smoke:electron` or the exact production launch command if no script was added.

Expected: PASS with evidence that visible app content rendered.

## Self-Review

- Spec coverage: The plan covers production frontend build, Electron build, backend tests, production startup, root-cause fixes, and verification.
- Placeholder scan: No placeholder task remains; conditional steps are tied to concrete observed failures.
- Type consistency: File paths, commands, and script names are consistent across tasks.
