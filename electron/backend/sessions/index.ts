import { aggregateProjects, buildOverview, filterSummaries } from './sessionAnalytics'
import { listClaudeSessions, readClaudeSession } from './claudeSessions'
import { listCodexSessions, readCodexSession } from './codexSessions'
import { searchSessionMessages } from './sessionSearch'
import { trashSession } from './sessionTrash'
import type {
  DeleteSessionRequest,
  DeleteSessionResult,
  ListSessionsRequest,
  ProjectSessionOverview,
  SearchSessionsRequest,
  SessionDetail,
  SessionDetailRequest,
  SessionOverview,
  SessionRuntimeOptions,
  SessionSearchHit,
  SessionSummary,
  SessionsOverviewRequest,
} from './sessionTypes'

export async function listSessions(request: ListSessionsRequest, options: SessionRuntimeOptions = {}): Promise<SessionSummary[]> {
  const [claude, codex] = await Promise.all([
    request.agent === 'codex' ? Promise.resolve([]) : listClaudeSessions(options.homeDir),
    request.agent === 'claude' ? Promise.resolve([]) : listCodexSessions(options.homeDir),
  ])
  return filterSummaries([...claude, ...codex], request).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export async function getSessionDetail(request: SessionDetailRequest, options: SessionRuntimeOptions = {}): Promise<SessionDetail> {
  const sessions = await listSessions({ agent: request.agent, scope: 'all' }, options)
  const session = sessions.find((candidate) => candidate.id === request.sessionId)
  if (!session) throw new Error(`Session not found: ${request.sessionId}`)
  return request.agent === 'claude' ? readClaudeSession(session.path) : readCodexSession(session.path)
}

export async function listSessionProjects(request: ListSessionsRequest, options: SessionRuntimeOptions = {}): Promise<ProjectSessionOverview[]> {
  const details = await listSessionDetails(request, options)
  return aggregateProjects(details)
}

export async function getSessionsOverview(request: SessionsOverviewRequest, options: SessionRuntimeOptions = {}): Promise<SessionOverview> {
  const details = await listSessionDetails({
    agent: request.agent,
    projectPath: request.projectPath,
    scope: request.scope === 'project' ? 'current-project' : 'all',
  }, options)
  return buildOverview(details, request)
}

export async function searchSessions(request: SearchSessionsRequest, options: SessionRuntimeOptions = {}): Promise<SessionSearchHit[]> {
  return searchSessionMessages(request, options)
}

export async function deleteSession(request: DeleteSessionRequest, options: SessionRuntimeOptions = {}): Promise<DeleteSessionResult> {
  return trashSession(request, options)
}

async function listSessionDetails(request: ListSessionsRequest, options: SessionRuntimeOptions) {
  const sessions = await listSessions(request, options)
  return Promise.all(sessions.map((session) => getSessionDetail({ agent: session.agent, sessionId: session.id }, options)))
}
