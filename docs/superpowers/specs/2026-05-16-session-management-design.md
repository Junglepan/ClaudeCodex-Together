# cc-steward Session Management Design

Date: 2026-05-16

## Scope

Add a new first-class Session Management module at the same product level as configuration management. This feature manages local Claude and Codex session history files by project, while preserving the existing cc-steward principle that all data comes from local files.

In scope for the first version:

- Separate Claude and Codex session discovery.
- Project index and project-level session metrics.
- Project-scoped session listing.
- Real-time refresh from local session file changes.
- Session message display.
- Message navigation for long conversations.
- Text search across session messages.
- Session, project, and user-level analytics.
- Safe deletion by moving sessions to a cc-steward trash area.
- Finder, terminal, and copy-path integration for session files.

Out of scope for the first version:

- Remote sync or cloud upload.
- SQLite or persistent search indexing.
- Cross-agent session merging.
- Permanent deletion without a recoverable trash step.
- Editing session content.
- Generating summaries with an AI model.
- Remote session control, prompt submission, or permission approval.

## Product Model

Session Management is not part of Configuration Management. It is a sibling module:

- Configuration Management answers: what files configure Claude and Codex?
- Session Management answers: what local conversations exist, what did they contain, and how can they be found or cleaned up?

Claude and Codex sessions should be managed independently because their local file layouts and message formats differ. The UI can share presentation components, but backend scanners and parsers should remain agent-specific.

The feature should be positioned as:

> A local Claude / Codex session index, search, analytics, and cleanup tool.

It should not become a replacement chat client in the first version. Starting, resuming, and controlling active agents can be evaluated later.

## Architecture

Add a new frontend module:

```text
src/modules/sessions/
  SessionsPage.tsx
  ProjectSessionsOverview.tsx
  SessionList.tsx
  SessionDetail.tsx
  MessageNavigator.tsx
  SessionSearch.tsx
  SessionAnalytics.tsx
  index.ts
```

Add a new backend session domain:

```text
electron/backend/sessions/
  index.ts
  claudeSessions.ts
  codexSessions.ts
  sessionAnalytics.ts
  sessionSearch.ts
  sessionTypes.ts
  sessionTrash.ts
  sessionWatchPaths.ts
```

Only shared app integration files should be touched:

```text
electron/backend/api.ts
src/core/api.ts
src/modules/index.ts
```

This keeps the feature mostly isolated and reduces merge conflicts with ongoing configuration-management work.

## Data Types

The backend returns unified session DTOs. Agent-specific parsers map raw local files into these shapes.

```ts
export interface SessionSummary {
  id: string
  agent: 'claude' | 'codex'
  projectPath: string | null
  title: string
  path: string
  messageCount: number
  updatedAt: string
  sizeBytes: number
}

export interface SessionMessage {
  id: string
  role: 'user' | 'assistant' | 'system' | 'tool' | 'unknown'
  content: string
  timestamp?: string
  toolName?: string
  toolStatus?: 'ok' | 'error' | 'unknown'
  skillName?: string
  subagentName?: string
  raw?: unknown
}

export interface SessionDetail extends SessionSummary {
  messages: SessionMessage[]
  stats: SessionStats
  rawPreview?: string
}

export interface SessionSearchHit {
  session: SessionSummary
  messageId: string
  role: SessionMessage['role']
  excerpt: string
}

export interface SessionStats {
  messageCount: number
  userMessageCount: number
  assistantMessageCount: number
  toolMessageCount: number
  toolCallCount: number
  failedToolCallCount: number
  tools: Array<{ name: string; count: number; failedCount: number }>
  skills: Array<{ name: string; count: number; confidence: 'exact' | 'inferred' }>
  subagents: Array<{ name: string; count: number; confidence: 'exact' | 'inferred' }>
  sizeBytes: number
  updatedAt: string
}

export interface ProjectSessionOverview {
  projectPath: string | null
  sessionCount: number
  messageCount: number
  toolCallCount: number
  lastActiveAt: string | null
  totalSizeBytes: number
  agentBreakdown: Record<'claude' | 'codex', number>
  topTools: Array<{ name: string; count: number }>
}

export interface SessionOverview {
  scope: 'user' | 'project'
  projectPath?: string
  totalSessions: number
  totalMessages: number
  totalToolCalls: number
  failedToolCalls: number
  totalSizeBytes: number
  recentSessionCount: number
  agentBreakdown: Record<'claude' | 'codex', number>
  topProjects: ProjectSessionOverview[]
  topTools: Array<{ name: string; count: number }>
  topSkills: Array<{ name: string; count: number; confidence: 'exact' | 'inferred' }>
  topSubagents: Array<{ name: string; count: number; confidence: 'exact' | 'inferred' }>
}
```

Session IDs should be stable within a machine. A deterministic hash of `agent + absolute file path` is sufficient for the first version.

## Backend API

Expose new IPC backend endpoints through the existing `electronApi.backend()` pattern:

```ts
sessions.list
sessions.detail
sessions.projects
sessions.overview
sessions.search
sessions.delete
sessions.watchPaths
```

Request shapes:

```ts
interface ListSessionsRequest {
  agent?: 'claude' | 'codex'
  projectPath?: string
  scope: 'current-project' | 'all'
}

interface SessionDetailRequest {
  agent: 'claude' | 'codex'
  sessionId: string
}

interface SearchSessionsRequest {
  agent?: 'claude' | 'codex'
  projectPath?: string
  scope: 'current-project' | 'all'
  query: string
  role?: 'user' | 'assistant' | 'system' | 'tool' | 'unknown'
  toolName?: string
}

interface DeleteSessionRequest {
  agent: 'claude' | 'codex'
  sessionId: string
}

interface SessionsOverviewRequest {
  agent?: 'claude' | 'codex'
  projectPath?: string
  scope: 'user' | 'project'
}
```

Delete response:

```ts
interface DeleteSessionResult {
  deleted: true
  originalPath: string
  trashPath: string
}
```

## Discovery and Project Filtering

Session scanners must only read local files.

Claude and Codex get separate scanners:

- `claudeSessions.ts` discovers Claude session files and extracts project paths from Claude's local session metadata where available.
- `codexSessions.ts` discovers Codex session files and extracts project paths from Codex's local session metadata where available.

If a file cannot be parsed but can be associated with an agent, the scanner should still return a summary with:

- `title` from filename.
- `projectPath: null`.
- `messageCount: 0`.
- `rawPreview` available in detail view.

Project filtering rules:

- `scope: 'current-project'` returns sessions whose normalized `projectPath` matches the active `projectPath`.
- `scope: 'all'` returns all discovered sessions.
- If a session has no project path, it appears only in `all` scope unless the user later chooses an explicit "Unknown project" filter.

## Project Index

The Session Management landing state should lead with project-level visibility, not only a flat file list.

Project index data:

- normalized project path
- session count
- message count
- tool call count
- Claude / Codex breakdown
- last active timestamp
- total session file size
- top tools for the project

The project index supports:

- current project shortcut
- all projects view
- unknown project bucket
- sorting by last active, session count, message count, or size

This gives users a quick answer to "which projects have the most agent activity?" without opening individual sessions.

## Real-Time Refresh

Real-time means local file synchronization, not agent process control.

The Electron backend should expose the directories that contain Claude and Codex session files through `sessions.watchPaths`. The renderer can merge these with the existing watcher mechanism.

Refresh behavior:

- New session files appear in the session list after debounce.
- Appended messages refresh the selected detail view.
- Deleted or trashed files disappear from active lists.
- Search results should be invalidated when watched files change.
- Analytics should recompute from refreshed summaries.

The watcher must stay scoped to known session roots. It must not recursively watch the entire home directory.

## Message Display

The detail panel displays messages in chronological order. Role presentation:

- `user`: primary input message.
- `assistant`: assistant response.
- `tool`: collapsed by default, expandable.
- `system`: subdued styling.
- `unknown`: raw fallback styling.

Large message bodies should be truncated in the list and expandable in detail view. Raw message data may be shown behind a "Raw" disclosure for debugging parser gaps.

Long sessions also need navigation:

- Build a message navigator from user messages, assistant messages, and tool-call boundaries.
- Allow jumping to a message or turn.
- Allow filtering the detail view by role.
- Keep tool calls collapsed by default but count them in the navigator.

Message construction should prefer conversation turns when the source format allows it:

- user prompt
- assistant response
- tool calls and tool results belonging to that assistant response
- follow-up assistant continuation

If the source format does not expose turn grouping, chronological message order is acceptable.

## Tool, Skill, and Subagent Analytics

Analytics must be based only on locally observable session data.

Session-level metrics:

- total messages
- messages by role
- tool call count
- failed tool call count
- tool name distribution
- skill usage distribution
- subagent usage distribution
- file size
- last updated timestamp

Project-level metrics:

- sessions per agent
- messages per agent
- top tools
- top skills
- top subagents
- total local storage used
- most recent session

User-level metrics:

- total sessions
- total messages
- recent session count
- Claude / Codex split
- top active projects
- top tools / skills / subagents
- total local storage used by session files

Accuracy rules:

- Tool calls should be exact when the log has structured tool fields.
- Skill and subagent usage should be exact only when the log has explicit metadata.
- If usage is inferred from text or command markers, mark it with `confidence: 'inferred'`.
- The UI must not imply inferred counts are exact.

## Search

First version search is real-time local text search, not indexed search.

Behavior:

- Query must be non-empty after trimming.
- Search reads discovered session files for the selected agent and scope.
- Results are message-level hits where possible.
- Each hit includes a short excerpt around the match.
- Very large files should be read defensively. If a file cannot be parsed, search can still match against raw text and return a raw hit.
- Search can be narrowed by agent, project scope, role, and tool name.
- Clicking a search hit opens the session and scrolls to the matched message.

This keeps the first version simple and avoids introducing index invalidation, background workers, or persistent databases.

Follow-up search enhancements may include:

- result ranking
- fuzzy matching
- cached parsed messages
- date range filtering
- search history

These are not first-version requirements.

## Deletion

Deletion must be recoverable.

Implementation:

```text
~/.cc-steward/trash/sessions/<agent>/<timestamp>-<session-id>/
  session-file-or-directory
  manifest.json
```

`manifest.json` records:

- original path
- trash path
- agent
- deletion timestamp
- project path if known

The first version only moves files into trash. Permanent cleanup can be added later as a separate explicit feature.

UI must show the original path and trash path after deletion.

The first version does not need a full restore UI, but the manifest must contain enough information to support restore later.

## Sidecar Metadata

Do not modify Claude or Codex session files to support cc-steward-only metadata.

Future annotations should use sidecar files:

```text
~/.cc-steward/session-meta/<session-id>.json
```

Potential sidecar fields:

- favorite
- tags
- user title override
- notes
- archived state

Sidecar metadata is a follow-up capability. The first version should reserve the design but does not need to implement editing metadata.

## Frontend UX

Add a sidebar item: `会话管理`.

Page layout:

- Top controls:
  - Agent segmented control: `Claude` / `Codex` / `全部`.
  - Scope segmented control: `当前项目` / `全部项目`.
  - Search input.
- Overview band:
  - total sessions
  - total messages
  - total tool calls
  - local storage used
  - Claude / Codex split
- Main area:
  - Left: project index or session list.
  - Right: selected session detail.

Session list item:

- title
- agent badge
- project path or `未知项目`
- updated time
- message count
- file size

Detail actions:

- reveal in Finder
- open containing folder in terminal
- copy path
- delete to trash

Detail utilities:

- message navigator
- role filter
- tool-call visibility toggle
- raw message disclosure

Deletion must require confirmation and must not run from a single accidental click.

Suggested first-version views:

- `项目概览`: project index and user-level metrics.
- `会话列表`: filtered sessions for selected project or all projects.
- `会话详情`: message stream, navigator, tool details, raw view.
- `统计`: focused analytics view if the overview band becomes too dense.

## Testing Strategy

Use test-driven development.

Backend tests:

- Claude scanner discovers sessions from fixture directories.
- Codex scanner discovers sessions from fixture directories.
- Project filtering returns only matching sessions.
- Detail parser returns normalized message roles.
- Detail parser builds tool messages and failed tool statistics.
- Project overview aggregates sessions, messages, tools, and size.
- User overview aggregates across projects and agents.
- Search returns message-level excerpts.
- Search supports role and tool filters.
- Delete moves files into trash and writes manifest.
- Watch path discovery returns scoped session roots and avoids home-wide watches.

Frontend verification:

- Type-check API contracts.
- Manually inspect session list, detail, search, and delete confirmation in development UI once backend tests pass.

Verification commands:

```bash
npm run test:backend
npm run type-check
npm run build:electron
```

## Worktree Strategy

Implement this feature in a separate worktree and branch from the latest stable base. Recommended branch:

```text
feature/session-management
```

Rationale:

- Current configuration-management work has active uncommitted changes.
- Session Management should remain a mostly isolated module.
- Merge conflicts should be limited to module registration and API dispatch files.

Before merging back, rebase onto the latest configuration-management branch and resolve shared integration files deliberately.

## Reference-Informed Feature Notes

Existing local session tools commonly include:

- real-time log viewing
- project/session browsing
- global search
- analytics dashboards
- message navigation
- delete-to-trash
- reveal/copy path actions
- session launch/resume commands
- git or commit traceability

For cc-steward, the first version should adopt the local browsing, search, analytics, message navigation, and safe cleanup ideas. It should defer launch/resume and git traceability until the read-only session model is stable.

## Risks

Session file formats may differ across Claude and Codex versions. Mitigation: parser failures should degrade to raw preview rather than crashing the page.

Search may become slow on large histories. Mitigation: keep first-version search simple but bounded, and defer indexing until real performance data shows it is needed.

Deletion can destroy valuable history if implemented carelessly. Mitigation: deletion moves to trash with a manifest; no permanent delete in the first version.

Analytics can be misleading if inferred data is shown as exact. Mitigation: every inferred skill or subagent metric carries confidence metadata and the UI labels it clearly.

Real-time watching can be expensive if scoped poorly. Mitigation: session watch paths come from agent-specific known session roots, not from recursive home-directory scans.
