import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { buildSessionStats } from './sessionAnalytics'
import type { SessionAgent, SessionDetail, SessionMessage, SessionSummary } from './sessionTypes'

const SESSION_EXTENSIONS = new Set(['.jsonl', '.json', '.ndjson'])

export function claudeSessionRoot(homeDir = os.homedir()) {
  return path.join(homeDir, '.claude', 'projects')
}

export async function listClaudeSessions(homeDir?: string): Promise<SessionSummary[]> {
  const files = await collectSessionFiles(claudeSessionRoot(homeDir))
  const summaries = await Promise.all(files.map((file) => readSessionDetail('claude', file)))
  return summaries.map(stripDetail).sort(sortByUpdatedDesc)
}

export async function readClaudeSession(filePath: string): Promise<SessionDetail> {
  return readSessionDetail('claude', filePath)
}

export async function collectSessionFiles(root: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(root, { withFileTypes: true })
    const files = await Promise.all(entries.map(async (entry) => {
      const entryPath = path.join(root, entry.name)
      if (entry.isDirectory()) return collectSessionFiles(entryPath)
      if (entry.isFile() && SESSION_EXTENSIONS.has(path.extname(entry.name))) return [entryPath]
      return []
    }))
    return files.flat()
  } catch {
    return []
  }
}

export async function readSessionDetail(agent: SessionAgent, filePath: string): Promise<SessionDetail> {
  const [stat, rawText] = await Promise.all([
    fs.stat(filePath),
    fs.readFile(filePath, 'utf8').catch(() => ''),
  ])
  const rawRows = parseRows(rawText)
  const messages = rawRows.map((row, index) => normalizeMessage(row, index)).filter(Boolean) as SessionMessage[]
  const projectPath = firstString(rawRows, ['cwd', 'project_path', 'projectPath']) ?? null
  const updatedAt = latestTimestamp(messages) ?? stat.mtime.toISOString()
  const detail: SessionDetail = {
    id: sessionId(agent, filePath),
    agent,
    projectPath,
    title: titleFromMessages(messages, filePath),
    path: filePath,
    messageCount: messages.length,
    updatedAt,
    sizeBytes: stat.size,
    messages,
    stats: {
      messageCount: 0,
      userMessageCount: 0,
      assistantMessageCount: 0,
      toolMessageCount: 0,
      toolCallCount: 0,
      failedToolCallCount: 0,
      tools: [],
      skills: [],
      subagents: [],
      sizeBytes: stat.size,
      updatedAt,
    },
    rawPreview: rawText.slice(0, 4000),
  }
  detail.stats = buildSessionStats(detail)
  return detail
}

function parseRows(rawText: string): unknown[] {
  if (!rawText.trim()) return []
  const rows = rawText.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
  if (rows.length > 1) return rows.map(parseJson).filter((row) => row !== null)
  const parsed = parseJson(rawText)
  if (Array.isArray(parsed)) return parsed
  return parsed ? [parsed] : []
}

function parseJson(rawText: string) {
  try {
    return JSON.parse(rawText)
  } catch {
    return null
  }
}

function normalizeMessage(row: unknown, index: number): SessionMessage | null {
  if (!row || typeof row !== 'object') return null
  const record = row as Record<string, any>
  const rawContent = record.message?.content ?? record.content ?? record.text ?? ''
  const toolUse = Array.isArray(rawContent) ? rawContent.find((item) => item?.type === 'tool_use') : null
  const role = normalizeRole(record.type ?? record.role, Boolean(toolUse))
  const toolName = record.toolName ?? record.tool_name ?? record.name ?? toolUse?.name
  const content = stringifyContent(rawContent || record.result || record.output)
  const skillName = inferLabel(content, /(?:skill|used skill)[:\s]+([A-Za-z0-9_.-]+)/i)
  const subagentName = inferLabel(content, /(?:subagent|agent)[:\s]+([A-Za-z0-9_.-]+)/i)

  return {
    id: String(record.uuid ?? record.id ?? `message-${index}`),
    role,
    content,
    timestamp: typeof record.timestamp === 'string' ? record.timestamp : undefined,
    toolName: typeof toolName === 'string' ? toolName : undefined,
    toolStatus: toolName ? (record.is_error || record.error ? 'error' : 'ok') : undefined,
    skillName,
    subagentName,
    raw: row,
  }
}

function normalizeRole(value: unknown, hasToolUse: boolean): SessionMessage['role'] {
  const role = String(value ?? '').toLowerCase()
  if (hasToolUse || role.includes('tool')) return 'tool'
  if (role.includes('user') || role === 'human') return 'user'
  if (role.includes('assistant')) return 'assistant'
  if (role.includes('system')) return 'system'
  return 'unknown'
}

function stringifyContent(value: unknown): string {
  if (typeof value === 'string') return value
  if (Array.isArray(value)) {
    return value.map((item) => {
      if (typeof item === 'string') return item
      if (item?.type === 'text' && typeof item.text === 'string') return item.text
      if (item?.type === 'tool_use') return `${item.name ?? 'tool'} ${JSON.stringify(item.input ?? {})}`
      return JSON.stringify(item)
    }).join('\n')
  }
  if (value == null) return ''
  return JSON.stringify(value)
}

function inferLabel(content: string, pattern: RegExp) {
  const match = content.match(pattern)
  return match?.[1]
}

function firstString(rows: unknown[], keys: string[]) {
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue
    const record = row as Record<string, unknown>
    for (const key of keys) {
      if (typeof record[key] === 'string' && record[key]) return path.normalize(record[key])
    }
  }
  return null
}

function latestTimestamp(messages: SessionMessage[]) {
  return messages.map((message) => message.timestamp).filter(Boolean).sort().at(-1)
}

function titleFromMessages(messages: SessionMessage[], filePath: string) {
  const firstUser = messages.find((message) => message.role === 'user' && message.content.trim())
  const title = firstUser?.content.trim().replace(/\s+/g, ' ').slice(0, 80)
  return title || path.basename(filePath)
}

function sessionId(agent: SessionAgent, filePath: string) {
  return crypto.createHash('sha1').update(`${agent}:${path.resolve(filePath)}`).digest('hex')
}

export function stripDetail(detail: SessionDetail): SessionSummary {
  const { messages: _messages, stats: _stats, rawPreview: _rawPreview, ...summary } = detail
  return summary
}

function sortByUpdatedDesc(a: SessionSummary, b: SessionSummary) {
  return b.updatedAt.localeCompare(a.updatedAt)
}
