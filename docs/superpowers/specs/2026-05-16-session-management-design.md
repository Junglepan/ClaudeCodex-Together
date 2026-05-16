# cc-steward Session Management Design

Date: 2026-05-16

## Scope

Add a new first-class Session Management module at the same product level as configuration management. This feature manages local Claude and Codex session history files by project, while preserving the existing cc-steward principle that all data comes from local files.

In scope for the first version:

- Separate Claude and Codex session discovery.
- Project-scoped session listing.
- Session message display.
- Text search across session messages.
- Safe deletion by moving sessions to a cc-steward trash area.
- Finder, terminal, and copy-path integration for session files.

Out of scope for the first version:

- Remote sync or cloud upload.
- SQLite or persistent search indexing.
- Cross-agent session merging.
- Permanent deletion without a recoverable trash step.
- Editing session content.
- Generating summaries with an AI model.

## Product Model

Session Management is not part of Configuration Management. It is a sibling module:

- Configuration Management answers: what files configure Claude and Codex?
- Session Management answers: what local conversations exist, what did they contain, and how can they be found or cleaned up?

Claude and Codex sessions should be managed independently because their local file layouts and message formats differ. The UI can share presentation components, but backend scanners and parsers should remain agent-specific.

## Architecture

Add a new frontend module:

```text
src/modules/sessions/
  SessionsPage.tsx
  SessionList.tsx
  SessionDetail.tsx
  SessionSearch.tsx
  index.ts
```

Add a new backend session domain:

```text
electron/backend/sessions/
  index.ts
  claudeSessions.ts
  codexSessions.ts
  sessionTypes.ts
  sessionTrash.ts
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
  raw?: unknown
}

export interface SessionDetail extends SessionSummary {
  messages: SessionMessage[]
  rawPreview?: string
}

export interface SessionSearchHit {
  session: SessionSummary
  messageId: string
  role: SessionMessage['role']
  excerpt: string
}
```

Session IDs should be stable within a machine. A deterministic hash of `agent + absolute file path` is sufficient for the first version.

## Backend API

Expose new IPC backend endpoints through the existing `electronApi.backend()` pattern:

```ts
sessions.list
sessions.detail
sessions.search
sessions.delete
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
}

interface DeleteSessionRequest {
  agent: 'claude' | 'codex'
  sessionId: string
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

## Message Display

The detail panel displays messages in chronological order. Role presentation:

- `user`: primary input message.
- `assistant`: assistant response.
- `tool`: collapsed by default, expandable.
- `system`: subdued styling.
- `unknown`: raw fallback styling.

Large message bodies should be truncated in the list and expandable in detail view. Raw message data may be shown behind a "Raw" disclosure for debugging parser gaps.

## Search

First version search is real-time local text search, not indexed search.

Behavior:

- Query must be non-empty after trimming.
- Search reads discovered session files for the selected agent and scope.
- Results are message-level hits where possible.
- Each hit includes a short excerpt around the match.
- Very large files should be read defensively. If a file cannot be parsed, search can still match against raw text and return a raw hit.

This keeps the first version simple and avoids introducing index invalidation, background workers, or persistent databases.

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

## Frontend UX

Add a sidebar item: `会话管理`.

Page layout:

- Top controls:
  - Agent segmented control: `Claude` / `Codex` / `全部`.
  - Scope segmented control: `当前项目` / `全部项目`.
  - Search input.
- Main area:
  - Left: session list.
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

Deletion must require confirmation and must not run from a single accidental click.

## Testing Strategy

Use test-driven development.

Backend tests:

- Claude scanner discovers sessions from fixture directories.
- Codex scanner discovers sessions from fixture directories.
- Project filtering returns only matching sessions.
- Detail parser returns normalized message roles.
- Search returns message-level excerpts.
- Delete moves files into trash and writes manifest.

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

## Risks

Session file formats may differ across Claude and Codex versions. Mitigation: parser failures should degrade to raw preview rather than crashing the page.

Search may become slow on large histories. Mitigation: keep first-version search simple but bounded, and defer indexing until real performance data shows it is needed.

Deletion can destroy valuable history if implemented carelessly. Mitigation: deletion moves to trash with a manifest; no permanent delete in the first version.
