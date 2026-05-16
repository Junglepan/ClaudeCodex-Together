export type SessionAgent = 'claude' | 'codex'
export type SessionRole = 'user' | 'assistant' | 'system' | 'tool' | 'unknown'

export interface SessionRuntimeOptions {
  homeDir?: string
  now?: () => Date
}

export interface ListSessionsRequest {
  agent?: SessionAgent
  projectPath?: string
  scope: 'current-project' | 'all'
}

export interface SessionDetailRequest {
  agent: SessionAgent
  sessionId: string
  offset?: number
  limit?: number
}

export interface SearchSessionsRequest {
  agent?: SessionAgent
  projectPath?: string
  scope: 'current-project' | 'all'
  query: string
  role?: SessionRole
  toolName?: string
  maxResults?: number
}

export interface DeleteSessionRequest {
  agent: SessionAgent
  sessionId: string
}

export interface SessionsOverviewRequest {
  agent?: SessionAgent
  projectPath?: string
  scope: 'user' | 'project'
}

export interface SessionSummary {
  id: string
  agent: SessionAgent
  projectPath: string | null
  title: string
  path: string
  messageCount: number
  updatedAt: string
  sizeBytes: number
  nativeId?: string
  toolCallCount: number
  topToolNames: string[]
  topSkillNames: string[]
  topSubagentNames: string[]
}

export interface SessionMessage {
  id: string
  role: SessionRole
  content: string
  timestamp?: string
  toolName?: string
  toolStatus?: 'ok' | 'error' | 'unknown'
  skillName?: string
  subagentName?: string
  subType?: 'tool_use' | 'tool_result'
}

export interface SessionDetail extends SessionSummary {
  messages: SessionMessage[]
  stats: SessionStats
  rawPreview?: string
  pagination?: { offset: number; limit: number; total: number }
}

export interface SessionSearchHit {
  session: SessionSummary
  messageId: string
  role: SessionRole
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
  agentBreakdown: Record<SessionAgent, number>
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
  agentBreakdown: Record<SessionAgent, number>
  topProjects: ProjectSessionOverview[]
  topTools: Array<{ name: string; count: number }>
  topSkills: Array<{ name: string; count: number; confidence: 'exact' | 'inferred' }>
  topSubagents: Array<{ name: string; count: number; confidence: 'exact' | 'inferred' }>
}

export interface DeleteSessionResult {
  deleted: true
  originalPath: string
  trashPath: string
}
