# Post-Release Gap Closure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the published `v1.1.0` behavior internally consistent by fixing Sync Center semantics, Overview health judgment, project context/version reporting, Electron integration gaps, and roadmap status.

**Architecture:** Keep the existing Electron IPC backend and React UI structure. Add small pure helpers for sync planning/execution and overview health classification so behavior is testable without launching Electron. Preserve the product decision that missing project env defaults to `~`.

**Tech Stack:** Electron main/preload IPC, Node.js fs/path/os, React 18 + TypeScript, existing `tsx --test` backend tests, `tsc` type-checking.

---

### Task 1: Sync Center Backend Semantics

**Files:**
- Modify: `electron/backend/sync.ts`
- Modify: `electron/backend/types.ts`
- Test: `electron/backend/sync.test.ts`

- [ ] **Step 1: Write failing sync tests**

Add tests covering write/skip/overwrite/unsupported and backup behavior:

```ts
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { syncDryRun, syncExecute } from './sync'

function makeTmp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'cc-steward-sync-'))
}

test('syncDryRun reports per-item write, skip, overwrite, and unsupported actions', () => {
  const root = makeTmp()
  const home = path.join(root, 'home')
  const project = path.join(root, 'project')
  fs.mkdirSync(path.join(home, '.claude', 'commands'), { recursive: true })
  fs.mkdirSync(path.join(home, '.claude'), { recursive: true })
  fs.mkdirSync(path.join(home, '.codex'), { recursive: true })
  fs.writeFileSync(path.join(home, '.claude', 'CLAUDE.md'), 'Use /compact carefully\n')
  fs.writeFileSync(path.join(home, '.claude', 'commands', 'ship.md'), 'ship it\n')
  fs.writeFileSync(path.join(home, '.codex', 'AGENTS.md'), 'existing\n')

  const skip = syncDryRun({ scope: 'global', replace: false, home_path: home, project_path: project } as any)
  assert.equal(skip.items.find((item) => item.type === 'Instruction')?.dry_run_action, 'would_skip')
  assert.equal(skip.items.find((item) => item.type === 'Command')?.dry_run_action, 'skip_unsupported')

  const overwrite = syncDryRun({ scope: 'global', replace: true, home_path: home, project_path: project } as any)
  assert.equal(overwrite.items.find((item) => item.type === 'Instruction')?.dry_run_action, 'would_overwrite')
})

test('syncExecute backs up existing targets before overwrite', () => {
  const root = makeTmp()
  const home = path.join(root, 'home')
  fs.mkdirSync(path.join(home, '.claude'), { recursive: true })
  fs.mkdirSync(path.join(home, '.codex'), { recursive: true })
  fs.writeFileSync(path.join(home, '.claude', 'CLAUDE.md'), 'new content\n')
  const target = path.join(home, '.codex', 'AGENTS.md')
  fs.writeFileSync(target, 'old content\n')

  const result = syncExecute({ scope: 'global', replace: true, home_path: home } as any)
  assert.deepEqual(result.errors, [])
  assert.equal(fs.readFileSync(target, 'utf8'), 'new content\n')
  assert.equal(result.overwritten.includes(target), true)
  assert.equal(result.backups.length, 1)
  assert.equal(fs.readFileSync(result.backups[0].backup, 'utf8'), 'old content\n')
})
```

- [ ] **Step 2: Run failing sync tests**

Run: `npx tsx --test electron/backend/sync.test.ts`

Expected before implementation: failures for missing `home_path`, missing `dry_run_action`, missing `overwritten`, and missing `backups`.

- [ ] **Step 3: Implement minimal sync semantics**

Update `SyncRequest` to accept `home_path?: string`; use that in tests and default to `homeDir()` in production. Build actions with item ids, calculate target existence before writes, set `dry_run_action`, and back up before overwrite:

```ts
interface SyncRequest {
  scope: 'all' | 'global' | 'project'
  project_path?: string | null
  home_path?: string | null
  replace?: boolean
}

interface WriteAction {
  itemId: string
  target: string
  content: string
}

interface BackupRecord {
  target: string
  backup: string
}
```

Add a timestamped backup helper using `.bak.<YYYYMMDD-HHMMSS>` and ensure unsupported items never produce write actions.

- [ ] **Step 4: Align Codex agent migration format**

Change migrated Codex agent targets from `.md` to `.toml` and write a minimal TOML shape with escaped strings:

```toml
name = "agent-name"
description = "description"
instructions = """
agent body
"""
```

Preserve Claude `tools` as a comment line when present and mark the item as `check`.

- [ ] **Step 5: Run sync tests until green**

Run: `npx tsx --test electron/backend/sync.test.ts`

Expected: all sync tests pass.

### Task 2: API Types and Sync UI State

**Files:**
- Modify: `src/core/api.ts`
- Modify: `src/modules/sync/SyncCenter.tsx`

- [ ] **Step 1: Update TypeScript API types**

Extend sync types:

```ts
export interface ApiSyncItem {
  status: 'added' | 'check' | 'unsupported' | 'not_added' | 'conflict'
  type: 'Instruction' | 'Skill' | 'Subagent' | 'Hook' | 'Command' | 'Settings' | 'MCP' | 'Plugin'
  name: string
  source: string
  target: string
  notes: string
  warnings?: string[]
  dry_run_action?: 'would_write' | 'would_skip' | 'would_overwrite' | 'skip_unsupported' | 'unknown'
}

export interface ApiSyncResult {
  dry_run: boolean
  items: ApiSyncItem[]
  written: string[]
  skipped: string[]
  overwritten: string[]
  backups: Array<{ target: string; backup: string }>
  errors?: string[]
}
```

- [ ] **Step 2: Update Sync Center labels**

Add `conflict` and `would_overwrite` labels. Remove dead `writableCount`. Preserve the dry-run panel during execution by carrying `dryRun` into the executing and done stages.

- [ ] **Step 3: Type-check UI changes**

Run: `npm run type-check`

Expected: no TypeScript errors in sync UI.

### Task 3: Overview Health Judgment

**Files:**
- Modify: `src/modules/overview/Overview.tsx`

- [ ] **Step 1: Extract pure health helpers**

Add local helper functions near the top of `Overview.tsx`:

```ts
function existing(files: ApiConfigFile[], key: string) {
  return files.find((file) => file.key === key)?.exists ?? false
}

function healthIssues(agentId: string, files: ApiConfigFile[], allFiles: Record<string, ApiConfigFile[]>, hasProject: boolean): string[] {
  const issues: string[] = []
  if (agentId === 'claude') {
    if (!existing(files, 'global_settings')) issues.push('全局 settings.json 未配置')
    if (!existing(files, 'global_instructions')) issues.push('全局 CLAUDE.md 未配置')
  }
  if (agentId === 'codex') {
    if (!existing(files, 'global_config')) issues.push('全局 config.toml 未配置')
    if (!existing(files, 'global_instructions')) issues.push('全局 AGENTS.md 未配置')
  }
  if (hasProject) {
    const claudeProject = existing(allFiles.claude ?? [], 'project_instructions')
    const codexProject = existing(allFiles.codex ?? [], 'project_instructions')
    if (agentId === 'claude' && codexProject && !claudeProject) issues.push('项目 CLAUDE.md 未同步')
    if (agentId === 'codex' && claudeProject && !codexProject) issues.push('项目 AGENTS.md 未同步')
  }
  return issues
}
```

- [ ] **Step 2: Use concrete issues in cards**

Pass `filesByAgent` to each `AgentCard`, replace `KEY_GLOBAL` warning logic with `healthIssues`, and show the first issue plus count when multiple issues exist.

- [ ] **Step 3: Keep comparison behavior aligned**

Ensure existing comparison rows continue to classify `CLAUDE.md ↔ AGENTS.md` as aligned, migratable, pending import, or unconfigured.

- [ ] **Step 4: Run type-check**

Run: `npm run type-check`

Expected: no TypeScript errors in Overview.

### Task 4: Project Context and Version Reporting

**Files:**
- Modify: `electron/backend/api.ts`
- Modify: `electron/backend/api.test.ts`
- Modify: `src/store/index.ts`

- [ ] **Step 1: Write failing API metadata tests**

Create or extend `electron/backend/api.test.ts`:

```ts
import assert from 'node:assert/strict'
import test from 'node:test'
import { handleBackendRequest } from './api'
import pkg from '../../package.json' with { type: 'json' }

test('health reports package version', async () => {
  const health = await handleBackendRequest({ endpoint: 'health' }) as { version: string }
  assert.equal(health.version, pkg.version)
})

test('meta keeps home as default project path when no env project is set', async () => {
  delete process.env.CC_STEWARD_PROJECT
  delete process.env.CCT_PROJECT
  const meta = await handleBackendRequest({ endpoint: 'meta' }) as { project_path: string; home_path: string }
  assert.equal(meta.project_path, meta.home_path)
})
```

- [ ] **Step 2: Run failing metadata tests**

Run: `npx tsx --test electron/backend/api.test.ts`

Expected before implementation: health version fails because it is hard-coded as `1.0.2`.

- [ ] **Step 3: Implement version reporting**

Import package metadata or read it once from the repo root in `electron/backend/api.ts`; return `packageJson.version` from `health`.

- [ ] **Step 4: Clarify store typing**

Keep `projectPath: string | undefined`; update comments to state `undefined` means metadata has not loaded yet and a string, including `~`, is the active project.

- [ ] **Step 5: Run metadata tests**

Run: `npx tsx --test electron/backend/api.test.ts`

Expected: all metadata tests pass.

### Task 5: Electron Watchers and Menu

**Files:**
- Modify: `electron/main.ts`
- Modify: `electron/preload.ts`
- Modify: `src/lib/electron-bridge.ts`
- Modify: `src/App.tsx`

- [ ] **Step 1: Expand watched paths conservatively**

In `src/App.tsx`, include known config directories in the existing watcher list:

```ts
const paths = [
  `${homePath}/.claude/CLAUDE.md`,
  `${homePath}/.claude/settings.json`,
  `${homePath}/.claude/agents`,
  `${homePath}/.claude/commands`,
  `${homePath}/.claude/skills`,
  `${homePath}/.codex/AGENTS.md`,
  `${homePath}/.codex/config.toml`,
  `${homePath}/.codex/agents`,
  `${homePath}/.codex/skills`,
  `${projectPath}/CLAUDE.md`,
  `${projectPath}/AGENTS.md`,
  `${projectPath}/.claude`,
  `${projectPath}/.codex`,
]
```

Keep main-process filtering to existing paths only.

- [ ] **Step 2: Add theme and GitHub menu actions**

In `electron/main.ts`, add View menu action `切换主题` sending `cct:menu-toggle-theme`, and Help menu action `在 GitHub 查看` opening the repository URL with `shell.openExternal`.

- [ ] **Step 3: Bridge theme menu action**

Expose `toggle-theme` through existing `onMenuAction`, dispatch a renderer event, and handle it in `App.tsx` by cycling `light -> dark -> auto -> light` using store state.

- [ ] **Step 4: Run type-check**

Run: `npm run type-check`

Expected: no Electron bridge typing errors.

### Task 6: ROADMAP Status Cleanup

**Files:**
- Modify: `docs/ROADMAP.md`

- [ ] **Step 1: Update only verified status lines**

Mark this batch's completed or already-completed scoped items as `[x]`, split partially completed items if necessary, and leave unrelated planned work untouched.

- [ ] **Step 2: Check roadmap for overclaims**

Run: `rg -n "post-release|v1.1.0|已完成|\\[x\\]" docs/ROADMAP.md`

Expected: updated entries correspond only to implemented behavior.

### Task 7: Final Verification

**Files:**
- No code changes expected.

- [ ] **Step 1: Run backend tests**

Run: `npm run test:backend`

Expected: all backend tests pass.

- [ ] **Step 2: Run type-check**

Run: `npm run type-check`

Expected: no TypeScript errors.

- [ ] **Step 3: Run build**

Run: `npm run build:electron`

Expected: Electron TypeScript build succeeds.

- [ ] **Step 4: Inspect git diff**

Run: `git diff --stat && git diff --check`

Expected: no whitespace errors and changes limited to this plan.
