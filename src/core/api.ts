const IS_FILE_PROTOCOL = typeof window !== 'undefined' && window.location.protocol === 'file:'
const BASE = IS_FILE_PROTOCOL ? 'http://127.0.0.1:8765' : '/api'

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`API ${res.status}: ${text || res.statusText}`)
  }
  return res.json() as Promise<T>
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
  status: 'added' | 'check' | 'unsupported' | 'not_added'
  type: 'Instruction' | 'Skill' | 'Subagent' | 'Hook' | 'Command' | 'Settings' | 'MCP' | 'Plugin'
  name: string
  source: string
  target: string
  notes: string
  warnings?: string[]
  dry_run_action?: 'would_write' | 'would_skip' | 'skip_unsupported' | 'unknown'
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
}

export interface ApiSyncResult {
  dry_run: boolean
  items: ApiSyncItem[]
  written: string[]
  skipped: string[]
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

// ── API ──────────────────────────────────────────────────────────────────────

export const api = {
  health: () => request<{ status: string; version: string }>('/health'),

  meta: () => request<ApiMeta>('/meta'),

  agents: {
    list: (projectPath?: string) =>
      request<ApiAgentSummary[]>(
        `/agents${projectPath ? `?project=${encodeURIComponent(projectPath)}` : ''}`,
      ),

    files: (agentId: string, projectPath?: string) =>
      request<ApiConfigFile[]>(
        `/agents/${agentId}/files${projectPath ? `?project=${encodeURIComponent(projectPath)}` : ''}`,
      ),
  },

  files: {
    read: (path: string) =>
      request<ApiFileDetail>(`/files/read?path=${encodeURIComponent(path)}`),

    meta: (agentId: string, fileKey: string, projectPath?: string) =>
      request<ApiFileDetail>(
        `/files/meta?agent=${agentId}&key=${fileKey}${projectPath ? `&project=${encodeURIComponent(projectPath)}` : ''}`,
      ),

    write: (path: string, content: string) =>
      request<{ path: string; written: boolean }>(
        '/files/write',
        { method: 'POST', body: JSON.stringify({ path, content }) },
      ),

    delete: (path: string) =>
      request<{ path: string; deleted: boolean }>(
        `/files/delete?path=${encodeURIComponent(path)}`,
        { method: 'DELETE' },
      ),
  },

  sync: {
    scan: (scope: 'global' | 'project' | 'all', projectPath?: string) =>
      request<ApiSyncScanResult>(
        '/sync/scan',
        { method: 'POST', body: JSON.stringify({ scope, project_path: projectPath }) },
      ),

    plan: (scope: 'global' | 'project' | 'all', projectPath?: string) =>
      request<ApiSyncPlan>(
        '/sync/plan',
        { method: 'POST', body: JSON.stringify({ scope, project_path: projectPath }) },
      ),

    dryRun: (scope: 'global' | 'project' | 'all', projectPath?: string, replace = false) =>
      request<ApiSyncDryRunResult>(
        '/sync/dry-run',
        { method: 'POST', body: JSON.stringify({ scope, project_path: projectPath, replace }) },
      ),

    execute: (scope: 'global' | 'project' | 'all', projectPath?: string, replace = false) =>
      request<ApiSyncResult>(
        '/sync/execute',
        { method: 'POST', body: JSON.stringify({ scope, project_path: projectPath, replace }) },
      ),
  },

  projects: {
    list: () => request<ApiProject[]>(`/projects`),
  },

  config: {
    resolved: (agentId: string, projectPath?: string) =>
      request<ApiResolvedConfig>(
        `/config/resolved?agent=${agentId}${projectPath ? `&project=${encodeURIComponent(projectPath)}` : ''}`,
      ),
  },
}

export interface ApiProject {
  path: string
  name: string
  exists: boolean
  source: 'claude' | 'codex' | 'both'
  last_used: number | null
}
