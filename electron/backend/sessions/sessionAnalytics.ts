import type {
  ProjectSessionOverview,
  SessionAgent,
  SessionDetail,
  SessionOverview,
  SessionStats,
  SessionSummary,
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

export function aggregateProjects(details: SessionDetail[]): ProjectSessionOverview[] {
  const projects = new Map<string, ProjectSessionOverview>()
  const toolCounts = new Map<string, Map<string, number>>()

  for (const detail of details) {
    const key = detail.projectPath ?? '__unknown__'
    const current = projects.get(key) ?? {
      projectPath: detail.projectPath,
      sessionCount: 0,
      messageCount: 0,
      toolCallCount: 0,
      lastActiveAt: null,
      totalSizeBytes: 0,
      agentBreakdown: emptyAgentBreakdown(),
      topTools: [],
    }
    current.sessionCount += 1
    current.messageCount += detail.stats.messageCount
    current.toolCallCount += detail.stats.toolCallCount
    current.totalSizeBytes += detail.sizeBytes
    current.agentBreakdown[detail.agent] += 1
    if (!current.lastActiveAt || detail.updatedAt > current.lastActiveAt) current.lastActiveAt = detail.updatedAt
    projects.set(key, current)

    const projectTools = toolCounts.get(key) ?? new Map<string, number>()
    for (const tool of detail.stats.tools) {
      projectTools.set(tool.name, (projectTools.get(tool.name) ?? 0) + tool.count)
    }
    toolCounts.set(key, projectTools)
  }

  for (const [key, project] of projects.entries()) {
    project.topTools = topCounts(toolCounts.get(key) ?? new Map()).slice(0, 5)
  }

  return [...projects.values()].sort((a, b) => {
    const activeCompare = (b.lastActiveAt ?? '').localeCompare(a.lastActiveAt ?? '')
    return activeCompare || (a.projectPath ?? '').localeCompare(b.projectPath ?? '')
  })
}

export function buildOverview(details: SessionDetail[], request: { scope: 'user' | 'project'; projectPath?: string }): SessionOverview {
  const relevant = request.scope === 'project'
    ? details.filter((detail) => detail.projectPath === request.projectPath)
    : details
  const tools = new Map<string, number>()
  const skills = new Map<string, number>()
  const subagents = new Map<string, number>()
  const agentBreakdown = emptyAgentBreakdown()
  const recentCutoff = Date.now() - 7 * 24 * 60 * 60 * 1000

  for (const detail of relevant) {
    agentBreakdown[detail.agent] += 1
    for (const tool of detail.stats.tools) tools.set(tool.name, (tools.get(tool.name) ?? 0) + tool.count)
    for (const skill of detail.stats.skills) skills.set(skill.name, (skills.get(skill.name) ?? 0) + skill.count)
    for (const subagent of detail.stats.subagents) subagents.set(subagent.name, (subagents.get(subagent.name) ?? 0) + subagent.count)
  }

  return {
    scope: request.scope,
    projectPath: request.projectPath,
    totalSessions: relevant.length,
    totalMessages: relevant.reduce((sum, detail) => sum + detail.stats.messageCount, 0),
    totalToolCalls: relevant.reduce((sum, detail) => sum + detail.stats.toolCallCount, 0),
    failedToolCalls: relevant.reduce((sum, detail) => sum + detail.stats.failedToolCallCount, 0),
    totalSizeBytes: relevant.reduce((sum, detail) => sum + detail.sizeBytes, 0),
    recentSessionCount: relevant.filter((detail) => Date.parse(detail.updatedAt) >= recentCutoff).length,
    agentBreakdown,
    topProjects: aggregateProjects(relevant).slice(0, 8),
    topTools: topCounts(tools).slice(0, 8),
    topSkills: topConfidenceCounts(skills).slice(0, 8),
    topSubagents: topConfidenceCounts(subagents).slice(0, 8),
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
