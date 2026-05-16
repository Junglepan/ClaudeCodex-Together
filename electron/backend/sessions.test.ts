import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import {
  deleteSession,
  getSessionDetail,
  getSessionsOverview,
  listSessionProjects,
  listSessions,
  searchSessions,
} from './sessions'
import { sessionWatchPaths } from './sessions/sessionWatchPaths'

function makeTmp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'cc-steward-sessions-'))
}

function writeJsonl(filePath: string, rows: unknown[]) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, rows.map((row) => JSON.stringify(row)).join('\n'))
}

function exists(filePath: string) {
  return fs.existsSync(filePath)
}

function seedSessions() {
  const home = makeTmp()
  writeJsonl(path.join(home, '.claude', 'projects', 'proj-a', 'claude-1.jsonl'), [
    { type: 'user', message: { content: 'Hello Claude, I need help with my project' }, timestamp: '2026-05-16T01:00:00.000Z', cwd: '/tmp/proj-a' },
    { type: 'assistant', message: { content: 'Hi! I would be happy to help you with your project. What do you need?' }, timestamp: '2026-05-16T01:00:01.000Z', cwd: '/tmp/proj-a' },
  ])
  writeJsonl(path.join(home, '.codex', 'sessions', '2026', '05', '16', 'codex-1.jsonl'), [
    { timestamp: '2026-05-16T02:00:00.000Z', type: 'session_meta', payload: { id: 'codex-uuid-1', cwd: '/tmp/proj-a', model: 'o4-mini' } },
    { timestamp: '2026-05-16T02:00:00.000Z', type: 'event_msg', payload: { type: 'user_message', message: 'Hello Codex, please help me refactor this module' } },
    { timestamp: '2026-05-16T02:00:01.000Z', type: 'event_msg', payload: { type: 'agent_message', message: 'Sure, I will analyze the module structure and suggest improvements' } },
  ])
  writeJsonl(path.join(home, '.claude', 'projects', 'proj-b', 'claude-2.jsonl'), [
    { type: 'user', message: { content: 'Other project needs some work on the authentication flow' }, timestamp: '2026-05-16T03:00:00.000Z', cwd: '/tmp/proj-b' },
    { type: 'assistant', message: { content: 'I will review the authentication flow and suggest changes' }, timestamp: '2026-05-16T03:00:01.000Z', cwd: '/tmp/proj-b' },
  ])
  return home
}

test('listSessions discovers Claude and Codex sessions with project metadata', async () => {
  const home = seedSessions()

  const sessions = await listSessions({ scope: 'all' }, { homeDir: home })
  const projectSessions = await listSessions({ scope: 'current-project', projectPath: path.normalize('/tmp/proj-a') }, { homeDir: home })

  assert.equal(sessions.length, 3)
  assert.deepEqual(sessions.map((session) => session.agent).sort(), ['claude', 'claude', 'codex'])
  assert.equal(projectSessions.length, 2)
  assert.ok(projectSessions.every((session) => session.projectPath === path.normalize('/tmp/proj-a')))
  assert.ok(sessions.every((session) => session.id.length > 10))
  assert.ok(sessions.every((session) => session.sizeBytes > 0))
})

test('detail normalizes messages and tool statistics', async () => {
  const home = makeTmp()
  writeJsonl(path.join(home, '.claude', 'projects', 'proj-a', 'session.jsonl'), [
    { type: 'user', message: { content: 'Use Bash' }, timestamp: '2026-05-16T01:00:00.000Z', cwd: '/tmp/proj-a' },
    { type: 'assistant', message: { content: [{ type: 'tool_use', name: 'Bash', input: { command: 'pwd' } }] }, timestamp: '2026-05-16T01:00:01.000Z', cwd: '/tmp/proj-a' },
    { type: 'tool_result', toolName: 'Bash', content: 'boom', is_error: true, timestamp: '2026-05-16T01:00:02.000Z', cwd: '/tmp/proj-a' },
    { type: 'assistant', message: { content: [{ type: 'tool_use', id: 'tu-skill-1', name: 'Skill', input: { skill: 'test-writer' } }] }, timestamp: '2026-05-16T01:00:03.000Z', cwd: '/tmp/proj-a' },
  ])
  const [summary] = await listSessions({ scope: 'all' }, { homeDir: home })

  const detail = await getSessionDetail({ agent: 'claude', sessionId: summary.id }, { homeDir: home })

  assert.equal(detail.messages.length, 4)
  assert.equal(detail.messages[1].role, 'tool')
  assert.equal(detail.messages[1].toolName, 'Bash')
  assert.equal(detail.stats.messageCount, 4)
  assert.equal(detail.stats.toolCallCount, 3)
  assert.equal(detail.stats.failedToolCallCount, 1)
  assert.deepEqual(detail.stats.tools, [{ name: 'Bash', count: 2, failedCount: 1 }, { name: 'Skill', count: 1, failedCount: 0 }])
  assert.deepEqual(detail.stats.skills, [{ name: 'test-writer', count: 1, confidence: 'inferred' }])
  assert.equal('raw' in detail.messages[0], false)
  assert.equal((detail.rawPreview ?? '').length > 0, true)
})

test('overview aggregates project and user metrics and watch paths are scoped', async () => {
  const home = seedSessions()

  const projects = await listSessionProjects({ scope: 'all' }, { homeDir: home })
  const user = await getSessionsOverview({ scope: 'user' }, { homeDir: home })
  const project = await getSessionsOverview({ scope: 'project', projectPath: path.normalize('/tmp/proj-a') }, { homeDir: home })
  const watchPaths = sessionWatchPaths({ homeDir: home })

  assert.equal(projects.length, 2)
  assert.equal(user.totalSessions, 3)
  assert.equal(user.agentBreakdown.claude, 2)
  assert.equal(user.agentBreakdown.codex, 1)
  assert.equal(project.totalSessions, 2)
  assert.equal(project.totalMessages, 4)
  assert.ok(watchPaths.every((watchPath) => watchPath !== home && watchPath !== os.homedir()))
  assert.ok(watchPaths.some((watchPath) => watchPath.endsWith(path.join('.claude', 'projects'))))
  assert.ok(watchPaths.some((watchPath) => watchPath.endsWith(path.join('.codex', 'sessions'))))
})

test('codex overview aggregates token counts, tools, and models from current JSONL records', async () => {
  const home = makeTmp()
  writeJsonl(path.join(home, '.codex', 'sessions', '2026', '05', '16', 'codex-current.jsonl'), [
    { timestamp: '2026-05-16T02:00:00.000Z', type: 'session_meta', payload: { id: 'codex-current', cwd: '/tmp/proj-a' } },
    { timestamp: '2026-05-16T02:00:01.000Z', type: 'turn_context', payload: { cwd: '/tmp/proj-a', model: 'gpt-5.5', collaboration_mode: { settings: { model: 'gpt-5.5' } } } },
    { timestamp: '2026-05-16T02:00:02.000Z', type: 'event_msg', payload: { type: 'user_message', message: 'Please inspect the repository' } },
    { timestamp: '2026-05-16T02:00:03.000Z', type: 'response_item', payload: { type: 'function_call', name: 'exec_command', call_id: 'call-1', arguments: '{"cmd":"pwd"}' } },
    { timestamp: '2026-05-16T02:00:04.000Z', type: 'response_item', payload: { type: 'function_call_output', call_id: 'call-1', output: '/tmp/proj-a' } },
    { timestamp: '2026-05-16T02:00:05.000Z', type: 'event_msg', payload: { type: 'token_count', info: { last_token_usage: { input_tokens: 100, output_tokens: 20, cached_input_tokens: 80, total_tokens: 120 } } } },
    { timestamp: '2026-05-16T02:00:06.000Z', type: 'turn_context', payload: { cwd: '/tmp/proj-a', model: 'gpt-5.5' } },
    { timestamp: '2026-05-16T02:00:07.000Z', type: 'event_msg', payload: { type: 'agent_message', message: 'I checked it.' } },
    { timestamp: '2026-05-16T02:00:08.000Z', type: 'response_item', payload: { type: 'custom_tool_call', name: 'apply_patch', call_id: 'call-2', input: 'patch' } },
    { timestamp: '2026-05-16T02:00:09.000Z', type: 'response_item', payload: { type: 'custom_tool_call_output', call_id: 'call-2', output: 'ok' } },
    { timestamp: '2026-05-16T02:00:10.000Z', type: 'event_msg', payload: { type: 'token_count', info: { last_token_usage: { input_tokens: 40, output_tokens: 10, cached_input_tokens: 30, reasoning_output_tokens: 5, total_tokens: 55 } } } },
  ])

  const [summary] = await listSessions({ agent: 'codex', scope: 'all' }, { homeDir: home })
  const overview = await getSessionsOverview({ agent: 'codex', scope: 'user' }, { homeDir: home })

  assert.equal(summary.messageCount, 6)
  assert.equal(summary.toolCallCount, 2)
  assert.deepEqual(summary.topToolNames, ['apply_patch', 'exec_command'])
  assert.deepEqual(summary.topModelNames, ['gpt-5.5'])
  assert.deepEqual(summary.tokenUsage, {
    inputTokens: 140,
    outputTokens: 30,
    cacheCreationTokens: 0,
    cacheReadTokens: 110,
  })
  assert.equal(overview.totalMessages, 6)
  assert.equal(overview.totalToolCalls, 2)
  assert.deepEqual(overview.topTools, [{ name: 'apply_patch', count: 1 }, { name: 'exec_command', count: 1 }])
  assert.deepEqual(overview.topModels, [{ name: 'gpt-5.5', count: 2 }])
  assert.deepEqual(overview.tokenUsage, {
    inputTokens: 140,
    outputTokens: 30,
    cacheCreationTokens: 0,
    cacheReadTokens: 110,
  })
})

test('search returns message hits and supports role and tool filters', async () => {
  const home = makeTmp()
  writeJsonl(path.join(home, '.claude', 'projects', 'proj-a', 'session.jsonl'), [
    { type: 'user', message: { content: 'Please deploy the app' }, timestamp: '2026-05-16T01:00:00.000Z', cwd: '/tmp/proj-a' },
    { type: 'tool_result', toolName: 'Bash', content: 'deploy complete', timestamp: '2026-05-16T01:00:01.000Z', cwd: '/tmp/proj-a' },
    { type: 'assistant', message: { content: 'Done' }, timestamp: '2026-05-16T01:00:02.000Z', cwd: '/tmp/proj-a' },
  ])

  const allHits = await searchSessions({ scope: 'all', query: 'deploy' }, { homeDir: home })
  const toolHits = await searchSessions({ scope: 'all', query: 'deploy', role: 'tool', toolName: 'Bash' }, { homeDir: home })

  assert.equal(allHits.length, 2)
  assert.equal(toolHits.length, 1)
  assert.equal(toolHits[0].role, 'tool')
  assert.match(toolHits[0].excerpt, /deploy/)
})

test('deleteSession moves session to trash and writes manifest', async () => {
  const home = seedSessions()
  const [summary] = await listSessions({ scope: 'all', agent: 'claude' }, { homeDir: home })

  const result = await deleteSession(
    { agent: summary.agent, sessionId: summary.id },
    { homeDir: home, now: () => new Date('2026-05-16T03:00:00.000Z') },
  )

  assert.equal(result.deleted, true)
  assert.equal(exists(summary.path), false)
  assert.equal(exists(result.trashPath), true)
  const manifestPath = path.join(path.dirname(result.trashPath), 'manifest.json')
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
  assert.equal(manifest.originalPath, summary.path)
  assert.equal(manifest.agent, summary.agent)
  assert.equal(manifest.projectPath, summary.projectPath)
})
