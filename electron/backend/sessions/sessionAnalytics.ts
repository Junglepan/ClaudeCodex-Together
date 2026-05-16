import type {
  ProjectSessionOverview,
  SessionAgent,
  SessionDetail,
  SessionOverview,
  SessionStats,
  SessionSummary,
  SessionsOverviewRequest,
} from './sessionTypes'

function emptyAgentBreakdown(): Record<SessionAgent, number> {
  return { claude: 0, codex: 0 }
}

function topCounts(counts: Map<string, number>) {
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
}

function topConfidenceCounts(counts: Map<string, number>, confidence: 'exact' | 'inferred' = 'inferred') {
  return topCounts(counts).map((item) => ({ ...item, confidence }))
}

export function buildSessionStats(detail: Pick<SessionDetail, 'messages' | 'sizeBytes' | 'updatedAt'>): SessionStats {
  const tools = new Map<string, { count: number; failedCount: number }>()
  const skills = new Map<string, number>()
  const subagents = new Map<string, number>()

  for (const message of detail.messages) {
    if (message.toolName) {
      const current = tools.get(message.toolName) ?? { count: 0, failedCount: 0 }
      current.count += 1
      if (message.toolStatus === 'error') current.failedCount += 1
      tools.set(message.toolName, current)
    }
    if (message.skillName) skills.set(message.skillName, (skills.get(message.skillName) ?? 0) + 1)
    if (message.subagentName) subagents.set(message.subagentName, (subagents.get(message.subagentName) ?? 0) + 1)
  }

  return {
    messageCount: detail.messages.length,
    userMessageCount: detail.messages.filter((message) => message.role === 'user').length,
    assistantMessageCount: detail.messages.filter((message) => message.role === 'assistant').length,
    toolMessageCount: detail.messages.filter((message) => message.role === 'tool').length,
    toolCallCount: detail.messages.filter((message) => message.role === 'tool' || message.toolName).length,
    failedToolCallCount: detail.messages.filter((message) => message.toolStatus === 'error').length,
    tools: [...tools.entries()]
      .map(([name, value]) => ({ name, count: value.count, failedCount: value.failedCount }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
    skills: topConfidenceCounts(skills),
    subagents: topConfidenceCounts(subagents),
    sizeBytes: detail.sizeBytes,
    updatedAt: detail.updatedAt,
  }
}

export function filterSummaries(summaries: SessionSummary[], request: { agent?: SessionAgent; projectPath?: string; scope?: 'current-project' | 'all' }) {
  return summaries.filter((summary) => {
    if (request.agent && summary.agent !== request.agent) return false
    if (request.scope === 'current-project' && summary.projectPath !== request.projectPath) return false
    if (request.scope === 'all' && request.projectPath && summary.projectPath !== request.projectPath) return false
    return true
  })
}

export function aggregateProjectsFromSummaries(summaries: SessionSummary[]): ProjectSessionOverview[] {
  const projects = new Map<string, ProjectSessionOverview>()
  for (const summary of summaries) {
    const key = summary.projectPath ?? '__unknown__'
    const current = projects.get(key) ?? {
      projectPath: summary.projectPath,
      sessionCount: 0,
      messageCount: 0,
      toolCallCount: 0,
      lastActiveAt: null,
      totalSizeBytes: 0,
      agentBreakdown: emptyAgentBreakdown(),
      topTools: [],
    }
    current.sessionCount += 1
    current.messageCount += summary.messageCount
    current.totalSizeBytes += summary.sizeBytes
    current.agentBreakdown[summary.agent] += 1
    if (!current.lastActiveAt || summary.updatedAt > current.lastActiveAt) current.lastActiveAt = summary.updatedAt
    projects.set(key, current)
  }
  return [...projects.values()].sort((a, b) => {
    const activeCompare = (b.lastActiveAt ?? '').localeCompare(a.lastActiveAt ?? '')
    return activeCompare || (a.projectPath ?? '').localeCompare(b.projectPath ?? '')
  })
}

export function buildOverviewFromSummaries(summaries: SessionSummary[], request: SessionsOverviewRequest): SessionOverview {
  const relevant = request.scope === 'project'
    ? summaries.filter((s) => s.projectPath === request.projectPath)
    : summaries
  const agentBreakdown = emptyAgentBreakdown()
  const recentCutoff = Date.now() - 7 * 24 * 60 * 60 * 1000

  for (const s of relevant) {
    agentBreakdown[s.agent] += 1
  }

  return {
    scope: request.scope,
    projectPath: request.projectPath,
    totalSessions: relevant.length,
    totalMessages: relevant.reduce((sum, s) => sum + s.messageCount, 0),
    totalToolCalls: 0,
    failedToolCalls: 0,
    totalSizeBytes: relevant.reduce((sum, s) => sum + s.sizeBytes, 0),
    recentSessionCount: relevant.filter((s) => Date.parse(s.updatedAt) >= recentCutoff).length,
    agentBreakdown,
    topProjects: aggregateProjectsFromSummaries(relevant).slice(0, 8),
    topTools: [],
    topSkills: [],
    topSubagents: [],
  }
}
