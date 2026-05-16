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

export interface StructuredWarnings {
  removed_lines: string[]
  tool_comments: string[]
  check_lines: Array<{ line: number; content: string }>
  manual_notes?: string[]
}

export interface ApiSyncItem {
  id?: string
  status: 'added' | 'check' | 'unsupported' | 'not_added' | 'conflict'
  type: 'Instruction' | 'Skill' | 'Subagent' | 'Hook' | 'Command' | 'Settings' | 'MCP' | 'Plugin'
  name: string
  source: string
  target: string
  notes: string
  warnings?: string[]
  structured_warnings?: StructuredWarnings | null
  dry_run_action?: 'would_write' | 'would_skip' | 'would_overwrite' | 'skip_unsupported' | 'unknown'
  source_content?: string
  target_content?: string
  existing_content?: string
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

export interface ApiValidationItem {
  status: 'ok' | 'warning' | 'error'
  target: string
  type: string
  detail: string
}

export interface ApiValidationResult {
  items: ApiValidationItem[]
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

export interface ApiSkillItem {
  name: string
  description: string
  source: 'global' | 'project'
  path: string
  content: string
}

export interface ApiSubagentItem {
  name: string
  description: string
  source: 'global' | 'project'
  path: string
  content: string
  format: 'md' | 'toml'
  tools?: string[]
}

export interface ApiMcpServerItem {
  name: string
  command: string
  args: string[]
  env: Record<string, string>
  source: 'global' | 'project'
  origin: string
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

    plan: (scope: 'global' | 'project' | 'all', projectPath?: string, replace = false) =>
      request<ApiSyncPlan>('sync.plan', { scope, project_path: projectPath, replace }),

    dryRun: (scope: 'global' | 'project' | 'all', projectPath?: string, replace = false, itemIds?: string[]) =>
      request<ApiSyncDryRunResult>('sync.dryRun', { scope, project_path: projectPath, replace, item_ids: itemIds }),

    execute: (scope: 'global' | 'project' | 'all', projectPath?: string, replace = false, itemIds?: string[]) =>
      request<ApiSyncResult>('sync.execute', { scope, project_path: projectPath, replace, item_ids: itemIds }),

    validate: (scope: 'global' | 'project' | 'all', projectPath?: string) =>
      request<ApiValidationResult>('sync.validate', { scope, project_path: projectPath }),

    report: (executeResult: ApiSyncResult, validation?: ApiValidationResult) =>
      request<string>('sync.report', { executeResult, validation }),
  },

  projects: {
    list: () => request<ApiProject[]>('projects.list'),
  },

  skills: {
    list: (agentId: string, projectPath?: string) =>
      request<ApiSkillItem[]>('skills.list', { agentId, project: projectPath }),
  },

  subagents: {
    list: (agentId: string, projectPath?: string) =>
      request<ApiSubagentItem[]>('subagents.list', { agentId, project: projectPath }),
  },

  mcp: {
    list: (agentId: string, projectPath?: string) =>
      request<ApiMcpServerItem[]>('mcp.list', { agentId, project: projectPath }),
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
