# Session Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a first-version local Claude / Codex session management module with project browsing, message display, search, analytics, safe delete, and scoped watcher paths.

**Architecture:** Backend session logic lives under `electron/backend/sessions/` with agent-specific discovery/parsing and shared analytics/search/trash utilities. The renderer consumes typed API wrappers from `src/core/api.ts` and exposes one dense operational page under `src/modules/sessions/`.

**Tech Stack:** Electron main/preload IPC, Node `fs/promises`, React + TypeScript + Tailwind, Node test runner through `tsx --test`.

---

## File Structure

- Create `electron/backend/sessions/sessionTypes.ts`: shared DTOs and request types.
- Create `electron/backend/sessions/index.ts`: public backend session API.
- Create `electron/backend/sessions/claudeSessions.ts`: Claude local session scanner/parser.
- Create `electron/backend/sessions/codexSessions.ts`: Codex local session scanner/parser.
- Create `electron/backend/sessions/sessionAnalytics.ts`: summary/detail/project/user aggregation.
- Create `electron/backend/sessions/sessionSearch.ts`: message-level text search.
- Create `electron/backend/sessions/sessionTrash.ts`: recoverable delete-to-trash.
- Create `electron/backend/sessions/sessionWatchPaths.ts`: scoped session roots for fs watching.
- Create `electron/backend/sessions.test.ts`: backend coverage with temp fixtures.
- Modify `electron/backend/api.ts`: route `sessions.*` endpoints.
- Modify `src/core/api.ts`: add session DTOs and API methods.
- Create `src/modules/sessions/index.ts`: module definition.
- Create `src/modules/sessions/SessionsPage.tsx`: container and data loading.
- Create `src/modules/sessions/ProjectSessionsOverview.tsx`: project/user metrics view.
- Create `src/modules/sessions/SessionList.tsx`: filtered sessions list.
- Create `src/modules/sessions/SessionDetail.tsx`: message display and delete action.
- Create `src/modules/sessions/MessageNavigator.tsx`: role/message jump controls.
- Create `src/modules/sessions/SessionSearch.tsx`: search input/results.
- Create `src/modules/sessions/SessionAnalytics.tsx`: compact stats display.
- Modify `src/modules/index.ts`: register session module.
- Modify `src/App.tsx`: include `sessions.watchPaths` in Electron watcher refresh.

## Task 1: Backend Types and Fixture-Driven Discovery

**Files:**
- Create: `electron/backend/sessions/sessionTypes.ts`
- Create: `electron/backend/sessions/claudeSessions.ts`
- Create: `electron/backend/sessions/codexSessions.ts`
- Create: `electron/backend/sessions/index.ts`
- Create: `electron/backend/sessions.test.ts`

- [ ] **Step 1: Write failing discovery tests**

Add tests that create temporary Claude JSONL and Codex JSONL files, then assert stable session summaries.

```ts
test('listSessions discovers Claude and Codex sessions with project metadata', async () => {
  const root = await mkdtemp(join(tmpdir(), 'cc-steward-sessions-'))
  const claudeRoot = join(root, '.claude', 'projects')
  const codexRoot = join(root, '.codex', 'sessions')
  await mkdir(join(claudeRoot, 'proj-a'), { recursive: true })
  await mkdir(join(codexRoot, '2026', '05', '16'), { recursive: true })
  await writeFile(join(claudeRoot, 'proj-a', 'claude-1.jsonl'), [
    JSON.stringify({ type: 'user', message: { content: 'Hello Claude' }, timestamp: '2026-05-16T01:00:00.000Z', cwd: '/tmp/proj-a' }),
    JSON.stringify({ type: 'assistant', message: { content: 'Hi' }, timestamp: '2026-05-16T01:00:01.000Z', cwd: '/tmp/proj-a' }),
  ].join('\n'))
  await writeFile(join(codexRoot, '2026', '05', '16', 'codex-1.jsonl'), [
    JSON.stringify({ role: 'user', content: 'Hello Codex', timestamp: '2026-05-16T02:00:00.000Z', cwd: '/tmp/proj-a' }),
    JSON.stringify({ role: 'assistant', content: 'Hi', timestamp: '2026-05-16T02:00:01.000Z', cwd: '/tmp/proj-a' }),
  ].join('\n'))

  const sessions = await listSessions({ scope: 'all' }, { homeDir: root })

  assert.equal(sessions.length, 2)
  assert.deepEqual(sessions.map((s) => s.agent).sort(), ['claude', 'codex'])
  assert.ok(sessions.every((s) => s.projectPath === '/tmp/proj-a'))
  assert.ok(sessions.every((s) => s.messageCount === 2))
})
```

- [ ] **Step 2: Run test and verify RED**

Run: `npm run test:backend -- electron/backend/sessions.test.ts`

Expected: FAIL because `electron/backend/sessions/index.ts` does not exist.

- [ ] **Step 3: Implement minimal discovery**

Define DTOs in `sessionTypes.ts`, add scanner functions that recursively read `.jsonl`, `.json`, and `.ndjson` files under `~/.claude/projects` and `~/.codex/sessions`, parse JSON lines defensively, normalize roles, derive `projectPath` from `cwd`, `project_path`, or `projectPath`, derive `title` from the first user message or filename, and generate IDs from `agent + absolute path`.

- [ ] **Step 4: Run discovery tests and commit**

Run: `npm run test:backend -- electron/backend/sessions.test.ts`

Expected: PASS for discovery tests.

Commit:

```bash
git add electron/backend/sessions electron/backend/sessions.test.ts
git commit -m "feat: discover local agent sessions"
```

## Task 2: Detail Parsing, Analytics, Project Overview, and Watch Paths

**Files:**
- Modify: `electron/backend/sessions/index.ts`
- Modify: `electron/backend/sessions/claudeSessions.ts`
- Modify: `electron/backend/sessions/codexSessions.ts`
- Create: `electron/backend/sessions/sessionAnalytics.ts`
- Create: `electron/backend/sessions/sessionWatchPaths.ts`
- Modify: `electron/backend/sessions.test.ts`

- [ ] **Step 1: Write failing tests for detail and metrics**

Add tests that assert message roles, tool statistics, project overview, user overview, and watcher roots.

```ts
test('detail normalizes messages and tool statistics', async () => {
  const root = await mkdtemp(join(tmpdir(), 'cc-steward-sessions-'))
  const file = join(root, '.claude', 'projects', 'proj-a', 'session.jsonl')
  await mkdir(dirname(file), { recursive: true })
  await writeFile(file, [
    JSON.stringify({ type: 'user', message: { content: 'Use Bash' }, timestamp: '2026-05-16T01:00:00.000Z', cwd: '/tmp/proj-a' }),
    JSON.stringify({ type: 'assistant', message: { content: [{ type: 'tool_use', name: 'Bash', input: { command: 'pwd' } }] }, timestamp: '2026-05-16T01:00:01.000Z', cwd: '/tmp/proj-a' }),
    JSON.stringify({ type: 'tool_result', toolName: 'Bash', content: 'boom', is_error: true, timestamp: '2026-05-16T01:00:02.000Z', cwd: '/tmp/proj-a' }),
  ].join('\n'))
  const [summary] = await listSessions({ scope: 'all' }, { homeDir: root })

  const detail = await getSessionDetail({ agent: 'claude', sessionId: summary.id }, { homeDir: root })

  assert.equal(detail.messages.length, 3)
  assert.equal(detail.stats.toolCallCount, 2)
  assert.equal(detail.stats.failedToolCallCount, 1)
  assert.deepEqual(detail.stats.tools, [{ name: 'Bash', count: 2, failedCount: 1 }])
})
```

```ts
test('overview aggregates project and user metrics and watch paths are scoped', async () => {
  const root = await seedTwoProjectFixture()

  const projects = await listSessionProjects({ scope: 'all' }, { homeDir: root })
  const user = await getSessionsOverview({ scope: 'user' }, { homeDir: root })
  const project = await getSessionsOverview({ scope: 'project', projectPath: '/tmp/proj-a' }, { homeDir: root })
  const watchPaths = sessionWatchPaths({ homeDir: root })

  assert.equal(projects.length, 2)
  assert.equal(user.totalSessions, 3)
  assert.equal(project.totalSessions, 2)
  assert.ok(watchPaths.every((p) => ![root, homedir()].includes(p)))
  assert.ok(watchPaths.some((p) => p.endsWith('.claude/projects')))
  assert.ok(watchPaths.some((p) => p.endsWith('.codex/sessions')))
})
```

- [ ] **Step 2: Run tests and verify RED**

Run: `npm run test:backend -- electron/backend/sessions.test.ts`

Expected: FAIL because detail stats, overview, and watch paths are not implemented.

- [ ] **Step 3: Implement analytics and watch paths**

Add shared aggregation helpers that count messages by role, count tool messages by `toolName`, mark failed tool calls when `toolStatus === 'error'`, aggregate projects by normalized project path, and return only `~/.claude/projects` plus `~/.codex/sessions` from `sessionWatchPaths`.

- [ ] **Step 4: Run tests and commit**

Run: `npm run test:backend -- electron/backend/sessions.test.ts`

Expected: PASS for discovery, detail, overview, and watch path tests.

Commit:

```bash
git add electron/backend/sessions electron/backend/sessions.test.ts
git commit -m "feat: aggregate session metrics"
```

## Task 3: Search and Recoverable Delete

**Files:**
- Create: `electron/backend/sessions/sessionSearch.ts`
- Create: `electron/backend/sessions/sessionTrash.ts`
- Modify: `electron/backend/sessions/index.ts`
- Modify: `electron/backend/sessions.test.ts`

- [ ] **Step 1: Write failing search/delete tests**

Add tests for message-level search, role/tool filters, and trash manifest creation.

```ts
test('search returns message hits and supports role and tool filters', async () => {
  const root = await seedSearchFixture()

  const allHits = await searchSessions({ scope: 'all', query: 'deploy' }, { homeDir: root })
  const toolHits = await searchSessions({ scope: 'all', query: 'deploy', role: 'tool', toolName: 'Bash' }, { homeDir: root })

  assert.equal(allHits.length, 2)
  assert.equal(toolHits.length, 1)
  assert.equal(toolHits[0].role, 'tool')
  assert.match(toolHits[0].excerpt, /deploy/)
})
```

```ts
test('deleteSession moves session to trash and writes manifest', async () => {
  const root = await seedSearchFixture()
  const [summary] = await listSessions({ scope: 'all' }, { homeDir: root })

  const result = await deleteSession({ agent: summary.agent, sessionId: summary.id }, { homeDir: root, now: () => new Date('2026-05-16T03:00:00.000Z') })

  assert.equal(result.deleted, true)
  assert.equal(await exists(summary.path), false)
  assert.equal(await exists(result.trashPath), true)
  const manifest = JSON.parse(await readFile(join(dirname(result.trashPath), 'manifest.json'), 'utf8'))
  assert.equal(manifest.originalPath, summary.path)
  assert.equal(manifest.agent, summary.agent)
})
```

- [ ] **Step 2: Run tests and verify RED**

Run: `npm run test:backend -- electron/backend/sessions.test.ts`

Expected: FAIL because search and delete are not implemented.

- [ ] **Step 3: Implement search and delete**

Search loads filtered summaries, reads detail messages, matches lowercase text against message content, applies `role` and `toolName` filters, and returns short excerpts. Delete resolves the summary by ID, creates `~/.cc-steward/trash/sessions/<agent>/<timestamp>-<session-id>/`, moves the file there, and writes `manifest.json`.

- [ ] **Step 4: Run tests and commit**

Run: `npm run test:backend -- electron/backend/sessions.test.ts`

Expected: PASS for all session backend tests.

Commit:

```bash
git add electron/backend/sessions electron/backend/sessions.test.ts
git commit -m "feat: search and trash local sessions"
```

## Task 4: Backend API and Frontend API Contract

**Files:**
- Modify: `electron/backend/api.ts`
- Modify: `electron/backend/api.test.ts`
- Modify: `src/core/api.ts`

- [ ] **Step 1: Write failing API routing tests**

Add backend API tests that call `handleBackendRequest({ endpoint: 'sessions.watchPaths' })` and `handleBackendRequest({ endpoint: 'sessions.list', payload: { scope: 'all' } })`.

```ts
test('backend routes session endpoints', async () => {
  const watchPaths = await handleBackendRequest({ endpoint: 'sessions.watchPaths' })
  const sessions = await handleBackendRequest({ endpoint: 'sessions.list', payload: { scope: 'all' } })

  assert.ok(Array.isArray(watchPaths))
  assert.ok(Array.isArray(sessions))
})
```

- [ ] **Step 2: Run tests and verify RED**

Run: `npm run test:backend -- electron/backend/api.test.ts`

Expected: FAIL because `sessions.*` routes do not exist.

- [ ] **Step 3: Implement API routes and typed frontend wrappers**

Import session functions into `electron/backend/api.ts`, route `sessions.list`, `sessions.detail`, `sessions.projects`, `sessions.overview`, `sessions.search`, `sessions.delete`, and `sessions.watchPaths`. Add matching `ApiSession*` types and `api.sessions.*` wrappers in `src/core/api.ts`.

- [ ] **Step 4: Run tests and commit**

Run:

```bash
npm run test:backend -- electron/backend/api.test.ts electron/backend/sessions.test.ts
npm run type-check
```

Expected: backend tests and type-check pass.

Commit:

```bash
git add electron/backend/api.ts electron/backend/api.test.ts src/core/api.ts
git commit -m "feat: expose session backend api"
```

## Task 5: Frontend Session Module

**Files:**
- Create: `src/modules/sessions/index.ts`
- Create: `src/modules/sessions/SessionsPage.tsx`
- Create: `src/modules/sessions/ProjectSessionsOverview.tsx`
- Create: `src/modules/sessions/SessionList.tsx`
- Create: `src/modules/sessions/SessionDetail.tsx`
- Create: `src/modules/sessions/MessageNavigator.tsx`
- Create: `src/modules/sessions/SessionSearch.tsx`
- Create: `src/modules/sessions/SessionAnalytics.tsx`
- Modify: `src/modules/index.ts`

- [ ] **Step 1: Add module using existing UI patterns**

Build a dense page with agent and scope segmented controls, search, project overview, session list, detail panel, message navigator, role filter, tool visibility toggle, copy-path button, and delete confirmation. Use `lucide-react` icons for commands.

- [ ] **Step 2: Wire delete and refresh behavior**

After delete succeeds, show a toast with original and trash path, reload sessions/projects/overview/search, and clear selected detail if it was deleted.

- [ ] **Step 3: Register sidebar module**

Register `sessionsModule` after the two config modules and before sync, with title `会话管理` and path `/sessions`.

- [ ] **Step 4: Run type-check and commit**

Run: `npm run type-check`

Expected: PASS.

Commit:

```bash
git add src/modules/sessions src/modules/index.ts
git commit -m "feat: add session management ui"
```

## Task 6: Electron Watcher Integration and Final Verification

**Files:**
- Modify: `src/App.tsx`
- Modify: `docs/ROADMAP.md`

- [ ] **Step 1: Add scoped session watch paths**

In the existing Electron watcher effect, call `api.sessions.watchPaths()`, merge the returned paths with existing config paths, and keep the watcher scoped to known directories.

- [ ] **Step 2: Update roadmap status**

Mark Session Management as implemented first version, with future work for restore UI, search indexing, summaries, launch/resume, and git traceability.

- [ ] **Step 3: Run full verification**

Run:

```bash
npm run test:backend
npm run type-check
npm run build:electron
git diff --check
```

Expected: all commands pass with no whitespace errors.

- [ ] **Step 4: Commit final integration**

```bash
git add src/App.tsx docs/ROADMAP.md
git commit -m "feat: refresh session changes in electron"
```

## Self-Review

- Spec coverage: discovery, project filtering, project index, real-time refresh paths, message display, analytics, search, safe delete, UI registration, and verification are mapped to tasks.
- Scope control: first version remains local read/search/delete only; no launch/resume, AI summaries, remote control, or persistent indexing.
- Type consistency: API names match the design: `sessions.list`, `sessions.detail`, `sessions.projects`, `sessions.overview`, `sessions.search`, `sessions.delete`, `sessions.watchPaths`.
