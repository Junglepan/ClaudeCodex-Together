import { electronApi } from '@/lib/electron-bridge'

async function request<T>(endpoint: string, payload?: Record<string, unknown>): Promise<T> {
  return electronApi.backend<T>(endpoint, payload)
}

// ── Types ────────────────────────────────────────────────────────────────────

export interface ApiAgentSummary {
  id: string
  name: string
  status: 'active' | 'not_installed' | 'partial'
  global_path: string
  file_count: number
}

export interface ApiConfigFile {
  key: string
  label: string
  path: string
  exists: boolean
  scope: 'global' | 'project'
  kind: 'file' | 'dir'
  format: string
  status: 'active' | 'optional' | 'available' | 'missing'
  size_bytes?: number
  modified_at?: string
  purpose?: string
}

export interface ParsedHook {
  event: string
  matcher?: string | null
  command: string
  script_path?: string | null
  script_exists?: boolean | null
}

export interface ApiFileDetail {
  path: string
  exists: boolean
  content?: string
  purpose: string
  details: string
  counterpart_agent?: string
  counterpart_path?: string
  counterpart_exists?: boolean
  parsed_hooks?: ParsedHook[] | null
}

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

export interface ApiSyncScanResult {
  items: ApiSyncItem[]
}

export interface ApiSyncPlan {
  items: ApiSyncItem[]
  stats: { migratable: number; needs_conversion: number; conflicts: number; unsupported: number }
}

export interface ApiSyncDryRunResult {
  dry_run: true
  items: ApiSyncItem[]
  would_write: string[]
  would_skip: string[]
  would_overwrite: string[]
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

export interface ResolvedSettingsRow {
  key: string
  value: string
  source: 'global' | 'project' | 'local_override' | 'merged'
  overrides: string[]
}

export interface ResolvedInstruction {
  path: string
  exists: boolean
  order: number
  scope: 'global' | 'project'
}

export interface ResolvedScopeItem {
  name: string
  source: 'global' | 'project'
  overridden_by: 'project' | null
}

export interface ApiResolvedConfig {
  agent: string
  project: string | null
  settings: ResolvedSettingsRow[]
  instructions: ResolvedInstruction[]
  skills: ResolvedScopeItem[]
  agents: ResolvedScopeItem[]
}

export interface ApiMeta {
  project_path: string
  home_path: string
  platform: string
  hostname: string
  python_version: string
}

export type ApiSessionAgent = 'claude' | 'codex'
export type ApiSessionRole = 'user' | 'assistant' | 'system' | 'tool' | 'unknown'

export interface ApiSessionSummary {
  id: string
  agent: ApiSessionAgent
  projectPath: string | null
  title: string
  path: string
  messageCount: number
  updatedAt: string
  sizeBytes: number
}

export interface ApiSessionMessage {
  id: string
  role: ApiSessionRole
  content: string
  timestamp?: string
  toolName?: string
  toolStatus?: 'ok' | 'error' | 'unknown'
  skillName?: string
  subagentName?: string
  raw?: unknown
}

export interface ApiSessionStats {
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

export interface ApiSessionDetail extends ApiSessionSummary {
  messages: ApiSessionMessage[]
  stats: ApiSessionStats
  rawPreview?: string
}

export interface ApiSessionSearchHit {
  session: ApiSessionSummary
  messageId: string
  role: ApiSessionRole
  excerpt: string
}

export interface ApiProjectSessionOverview {
  projectPath: string | null
  sessionCount: number
  messageCount: number
  toolCallCount: number
  lastActiveAt: string | null
  totalSizeBytes: number
  agentBreakdown: Record<ApiSessionAgent, number>
  topTools: Array<{ name: string; count: number }>
}

export interface ApiSessionOverview {
  scope: 'user' | 'project'
  projectPath?: string
  totalSessions: number
  totalMessages: number
  totalToolCalls: number
  failedToolCalls: number
  totalSizeBytes: number
  recentSessionCount: number
  agentBreakdown: Record<ApiSessionAgent, number>
  topProjects: ApiProjectSessionOverview[]
  topTools: Array<{ name: string; count: number }>
  topSkills: Array<{ name: string; count: number; confidence: 'exact' | 'inferred' }>
  topSubagents: Array<{ name: string; count: number; confidence: 'exact' | 'inferred' }>
}

// ── API ──────────────────────────────────────────────────────────────────────

export const api = {
  health: () => request<{ status: string; version: string }>('health'),

  meta: () => request<ApiMeta>('meta'),

  agents: {
    list: (projectPath?: string) =>
      request<ApiAgentSummary[]>('agents.list', { project: projectPath }),

    files: (agentId: string, projectPath?: string) =>
      request<ApiConfigFile[]>('agents.files', { agentId, project: projectPath }),
  },

  files: {
    read: (path: string) =>
      request<ApiFileDetail>('files.read', { path }),

    meta: (agentId: string, fileKey: string, projectPath?: string) =>
      request<ApiFileDetail>('files.meta', { agentId, key: fileKey, project: projectPath }),

    write: (path: string, content: string) =>
      request<{ path: string; written: boolean }>('files.write', { path, content }),

    delete: (path: string) =>
      request<{ path: string; deleted: boolean }>('files.delete', { path }),
  },

  sync: {
    scan: (scope: 'global' | 'project' | 'all', projectPath?: string) =>
      request<ApiSyncScanResult>('sync.scan', { scope, project_path: projectPath }),

    plan: (scope: 'global' | 'project' | 'all', projectPath?: string) =>
      request<ApiSyncPlan>('sync.plan', { scope, project_path: projectPath }),

    dryRun: (scope: 'global' | 'project' | 'all', projectPath?: string, replace = false) =>
      request<ApiSyncDryRunResult>('sync.dryRun', { scope, project_path: projectPath, replace }),

    execute: (scope: 'global' | 'project' | 'all', projectPath?: string, replace = false) =>
      request<ApiSyncResult>('sync.execute', { scope, project_path: projectPath, replace }),
  },

  projects: {
    list: () => request<ApiProject[]>('projects.list'),
  },

  sessions: {
    list: (params: { agent?: ApiSessionAgent; projectPath?: string; scope: 'current-project' | 'all' }) =>
      request<ApiSessionSummary[]>('sessions.list', params),

    detail: (agent: ApiSessionAgent, sessionId: string) =>
      request<ApiSessionDetail>('sessions.detail', { agent, sessionId }),

    projects: (params: { agent?: ApiSessionAgent; projectPath?: string; scope: 'current-project' | 'all' }) =>
      request<ApiProjectSessionOverview[]>('sessions.projects', params),

    overview: (params: { agent?: ApiSessionAgent; projectPath?: string; scope: 'user' | 'project' }) =>
      request<ApiSessionOverview>('sessions.overview', params),

    search: (params: {
      agent?: ApiSessionAgent
      projectPath?: string
      scope: 'current-project' | 'all'
      query: string
      role?: ApiSessionRole
      toolName?: string
    }) => request<ApiSessionSearchHit[]>('sessions.search', params),

    delete: (agent: ApiSessionAgent, sessionId: string) =>
      request<{ deleted: true; originalPath: string; trashPath: string }>('sessions.delete', { agent, sessionId }),

    watchPaths: () => request<string[]>('sessions.watchPaths'),
  },

  config: {
    resolved: (agentId: string, projectPath?: string) =>
      request<ApiResolvedConfig>('config.resolved', { agentId, project: projectPath }),
  },

  backup: {
    export: (projectPath?: string) =>
      request<{ filename: string; data: number[] }>('backup.export', { project: projectPath }),
  },
}

export interface ApiProject {
  path: string
  name: string
  exists: boolean
  source: 'claude' | 'codex' | 'both'
  last_used: number | null
}
