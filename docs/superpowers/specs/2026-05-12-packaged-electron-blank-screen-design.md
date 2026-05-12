# Packaged Electron Blank Screen Fix Design

## Goal

Fix the packaged Electron client so an installed release displays the React application instead of a blank window, then verify the project with repeatable automated checks.

## Scope

This work prioritizes the packaged Electron blank screen. It also runs the existing project checks and fixes issues those checks expose when they block a clean build, launch, or test run.

Out of scope: broad feature rewrites, UI redesign, adding new product behavior, or claiming exhaustive proof that every possible workflow is bug-free.

## Acceptance Criteria

- Production frontend build succeeds.
- Electron main/preload build succeeds.
- Packaged or production-style Electron launch loads the app shell instead of a blank window.
- Renderer failures are observable through logs or test assertions instead of silently producing a blank client.
- Existing TypeScript checks pass.
- Existing backend tests pass, or any environmental blocker is documented with the exact failing command and reason.

## Architecture

The app has three relevant runtime pieces:

- Vite/React renderer in `src/`, built into `dist/`.
- Electron main and preload scripts in `electron/`, built into `dist-electron/`.
- Python FastAPI backend in `backend/`, launched by Electron on port `8765`.

The likely failure modes are production-only paths:

- `file://` renderer loading uses an incorrect path or absolute asset URLs.
- Electron preload path is missing or resolved incorrectly from `dist-electron/main.js`.
- Packaged backend path or Python dependency startup blocks expected UI data.
- Renderer throws during boot and no automated check catches the failed DOM state.

## Testing Strategy

Use a reproducible production launch path rather than relying only on static inspection. The verification sequence should include:

- `npm run type-check`
- `npm run build:frontend`
- `npm run build:electron`
- Backend tests under `backend/tests`
- A production Electron smoke check that starts `dist-electron/main.js` with production-like environment and verifies the renderer reaches a nonblank app state.

## Implementation Strategy

First reproduce the blank screen or nearest production failure with logs. Then add the smallest test or smoke assertion that fails for the current behavior. Fix the root cause in the responsible layer: Vite base path, Electron load path, preload packaging, or renderer startup error handling. Finally rerun the complete verification sequence and record results.

## Risks

Running a fully packaged installer may require platform-specific signing or GUI permissions. If a packaged installer cannot run in this environment, production Electron launch from built artifacts is the fallback verification, and the exact limitation must be reported.
