import type {
  ProjectSessionOverview,
  SessionAgent,
  SessionDetail,
  SessionOverview,
  SessionStats,
  SessionSummary,
  SessionsOverviewRequest,
  TokenUsage,
} from './sessionTypes'
import { emptyTokenUsage } from './tokenUtils'

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

function addCount(target: Map<string, number>, name: string, count: number) {
  target.set(name, (target.get(name) ?? 0) + count)
}

export function buildSessionStats(detail: Pick<SessionDetail, 'messages' | 'sizeBytes' | 'updatedAt'>): SessionStats {
  const tools = new Map<string, { count: number; failedCount: number }>()
  const skills = new Map<string, number>()
  const subagents = new Map<string, number>()
  const models = new Map<string, number>()
  const tokenUsage = emptyTokenUsage()
  let totalDurationMs = 0
  let turnCount = 0

  for (const message of detail.messages) {
    if (message.toolName) {
      const current = tools.get(message.toolName) ?? { count: 0, failedCount: 0 }
      current.count += 1
      if (message.toolStatus === 'error') current.failedCount += 1
      tools.set(message.toolName, current)
    }
    if (message.skillName) skills.set(message.skillName, (skills.get(message.skillName) ?? 0) + 1)
    if (message.subagentName) subagents.set(message.subagentName, (subagents.get(message.subagentName) ?? 0) + 1)
    if (message.model) models.set(message.model, (models.get(message.model) ?? 0) + 1)
    if (message.tokenUsage) {
      tokenUsage.inputTokens += message.tokenUsage.inputTokens
      tokenUsage.outputTokens += message.tokenUsage.outputTokens
      tokenUsage.cacheCreationTokens += message.tokenUsage.cacheCreationTokens
      tokenUsage.cacheReadTokens += message.tokenUsage.cacheReadTokens
    }
    if (message.durationMs) {
      totalDurationMs += message.durationMs
      turnCount += 1
    }
  }

  return {
    messageCount: detail.messages.length,
    userMessageCount: detail.messages.filter((message) => message.role === 'user').length,
    assistantMessageCount: detail.messages.filter((message) => message.role === 'assistant').length,
    toolMessageCount: detail.messages.filter((message) => message.role === 'tool').length,
    toolCallCount: detail.messages.filter((message) => message.toolName || (message.role === 'tool' && message.subType === 'tool_use')).length,
    failedToolCallCount: detail.messages.filter((message) => message.toolStatus === 'error').length,
    tools: [...tools.entries()]
      .map(([name, value]) => ({ name, count: value.count, failedCount: value.failedCount }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
    skills: topConfidenceCounts(skills),
    subagents: topConfidenceCounts(subagents),
    tokenUsage,
    models: topCounts(models),
    totalDurationMs,
    turnCount,
    avgTurnDurationMs: turnCount > 0 ? Math.round(totalDurationMs / turnCount) : 0,
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
  const projectTools = new Map<string, Map<string, number>>()
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
    current.toolCallCount += summary.toolCallCount
    current.totalSizeBytes += summary.sizeBytes
    current.agentBreakdown[summary.agent] += 1
    if (!current.lastActiveAt || summary.updatedAt > current.lastActiveAt) current.lastActiveAt = summary.updatedAt
    projects.set(key, current)

    const tools = projectTools.get(key) ?? new Map<string, number>()
    for (const tool of summary.topTools) addCount(tools, tool.name, tool.count)
    projectTools.set(key, tools)
  }
  for (const [key, project] of projects.entries()) {
    project.topTools = topCounts(projectTools.get(key) ?? new Map()).slice(0, 5)
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
  const tools = new Map<string, number>()
  const skills = new Map<string, number>()
  const subagents = new Map<string, number>()
  const models = new Map<string, number>()
  const tokenUsage = emptyTokenUsage()
  let totalDurationMs = 0

  for (const s of relevant) {
    agentBreakdown[s.agent] += 1
    for (const tool of s.topTools) addCount(tools, tool.name, tool.count)
    for (const name of s.topSkillNames) skills.set(name, (skills.get(name) ?? 0) + 1)
    for (const name of s.topSubagentNames) subagents.set(name, (subagents.get(name) ?? 0) + 1)
    for (const model of s.topModels) addCount(models, model.name, model.count)
    tokenUsage.inputTokens += s.tokenUsage.inputTokens
    tokenUsage.outputTokens += s.tokenUsage.outputTokens
    tokenUsage.cacheCreationTokens += s.tokenUsage.cacheCreationTokens
    tokenUsage.cacheReadTokens += s.tokenUsage.cacheReadTokens
    totalDurationMs += s.totalDurationMs
  }

  return {
    scope: request.scope,
    projectPath: request.projectPath,
    totalSessions: relevant.length,
    totalMessages: relevant.reduce((sum, s) => sum + s.messageCount, 0),
    totalToolCalls: relevant.reduce((sum, s) => sum + s.toolCallCount, 0),
    failedToolCalls: 0,
    totalSizeBytes: relevant.reduce((sum, s) => sum + s.sizeBytes, 0),
    recentSessionCount: relevant.filter((s) => Date.parse(s.updatedAt) >= recentCutoff).length,
    agentBreakdown,
    topProjects: aggregateProjectsFromSummaries(relevant).slice(0, 8),
    topTools: topCounts(tools).slice(0, 8),
    topSkills: topConfidenceCounts(skills).slice(0, 8),
    topSubagents: topConfidenceCounts(subagents).slice(0, 8),
    tokenUsage,
    topModels: topCounts(models).slice(0, 8),
    totalDurationMs,
  }
}
