# Tag Release CI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and publish unsigned desktop installers from `v*` tags through GitHub Actions.

**Architecture:** Keep release orchestration in `.github/workflows/release.yml`. Each matrix job installs Node and Python dependencies, runs release-blocking checks, packages with electron-builder, uploads OS-specific artifacts, then a final job creates the GitHub Release.

**Tech Stack:** GitHub Actions, Node 20, Python 3.12, npm, pytest, electron-builder, softprops/action-gh-release.

---

## File Structure

- Modify `.github/workflows/release.yml`: add manual trigger, run release checks before packaging, use OS-specific artifact globs, and make missing artifacts fail.
- Optionally modify `.github/workflows/ci.yml`: keep normal push/PR validation aligned with release checks if needed after release workflow is stable.

## Task 1: Update Release Workflow

- [ ] **Step 1: Add manual fallback trigger**

Add `workflow_dispatch` alongside the existing `push.tags: ['v*']` trigger.

- [ ] **Step 2: Define explicit matrix artifact paths**

Use matrix entries with `name`, `os`, and `artifacts` so upload paths match each platform.

- [ ] **Step 3: Install backend test dependencies**

Run `python -m pip install -r backend/requirements.txt pytest` before backend tests.

- [ ] **Step 4: Run release-blocking checks**

Run these commands before packaging:

```bash
npm run type-check
npm run build:frontend
npm run check:file-assets
npm run build:electron
python -m pytest backend/tests
```

- [ ] **Step 5: Package with electron-builder**

Run `npx electron-builder --publish never` with `GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}`.

- [ ] **Step 6: Upload artifacts strictly**

Use `actions/upload-artifact@v4` with `if-no-files-found: error`.

## Task 2: Verify Workflow Locally

- [ ] **Step 1: Inspect workflow file**

Run: `sed -n '1,260p' .github/workflows/release.yml`

Expected: The workflow contains `workflow_dispatch`, release checks, strict artifact upload, and final GitHub Release creation.

- [ ] **Step 2: Run local release-equivalent checks**

Run:

```bash
npm run type-check
npm run build:frontend
npm run check:file-assets
npm run build:electron
PYTHONPATH=/private/tmp/cct_pytest python3 -m pytest backend/tests
```

Expected: All commands pass in the local environment.

- [ ] **Step 3: Confirm git diff is scoped**

Run: `git diff -- .github/workflows/release.yml docs/superpowers/specs/2026-05-12-tag-release-ci-design.md docs/superpowers/plans/2026-05-12-tag-release-ci.md`

Expected: Changes are limited to the release workflow and planning docs.

## Self-Review

- Spec coverage: The plan covers tag trigger, manual fallback, release checks, matrix artifacts, strict upload, and release creation.
- Placeholder scan: No placeholder tasks remain.
- Type consistency: Workflow job names, commands, and artifact paths are consistent across tasks.
