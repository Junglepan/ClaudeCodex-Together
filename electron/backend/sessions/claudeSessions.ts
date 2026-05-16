import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { buildSessionStats } from './sessionAnalytics'
import type { SessionAgent, SessionDetail, SessionMessage, SessionSummary } from './sessionTypes'

const SESSION_EXTENSIONS = new Set(['.jsonl', '.json', '.ndjson'])
const SUMMARY_PEEK_BYTES = 4096
const SCAN_LIMIT = 1024 * 1024

const METADATA_TYPES = new Set([
  'permission-mode', 'file-history-snapshot', 'attachment', 'ai-title',
  'last-prompt', 'queue-operation', 'summary', 'result',
])

export function claudeSessionRoot(homeDir = os.homedir()) {
  return path.join(homeDir, '.claude', 'projects')
}

export async function listClaudeSessions(homeDir?: string): Promise<SessionSummary[]> {
  return listSessionSummaries('claude', claudeSessionRoot(homeDir))
}

export async function listSessionSummaries(agent: SessionAgent, root: string): Promise<SessionSummary[]> {
  const files = await collectSessionFiles(root)
  const summaries = await Promise.all(files.map((file) => readSessionSummary(agent, file)))
  return (summaries.filter(Boolean) as SessionSummary[]).sort(sortByUpdatedDesc)
}

export async function readClaudeSession(filePath: string, pagination?: { offset?: number; limit?: number }): Promise<SessionDetail> {
  return readSessionDetail('claude', filePath, pagination)
}

async function readSessionSummary(agent: SessionAgent, filePath: string): Promise<SessionSummary | null> {
  try {
    const stat = await fs.stat(filePath)
    const fd = await fs.open(filePath, 'r')
    try {
      const scanSize = Math.min(stat.size, SCAN_LIMIT)
      const buf = Buffer.alloc(scanSize)
      await fd.read(buf, 0, scanSize, 0)
      const fullScan = buf.toString('utf8')

      const peek = fullScan.slice(0, SUMMARY_PEEK_BYTES)
      const lines = peek.split(/\r?\n/).filter(Boolean)
      const rows = lines.map(parseJson).filter(Boolean)
      const projectPath = firstString(rows, ['cwd', 'project_path', 'projectPath']) ?? null
      const title = titleFromRows(rows, filePath)
      const peekLines = lines.length
      const messageCount = stat.size <= SUMMARY_PEEK_BYTES
        ? peekLines
        : Math.round(peekLines * (stat.size / scanSize))

      const { toolCounts, skillNames, subagentNames } = fastScanToolStats(fullScan)
      const scale = stat.size > SCAN_LIMIT ? stat.size / SCAN_LIMIT : 1
      const toolCallCount = Math.round([...toolCounts.values()].reduce((a, b) => a + b, 0) * scale)

      return {
        id: sessionId(agent, filePath),
        agent,
        projectPath,
        title,
        path: filePath,
        messageCount,
        updatedAt: stat.mtime.toISOString(),
        sizeBytes: stat.size,
        nativeId: extractNativeId(filePath),
        toolCallCount,
        topToolNames: topNKeys(toolCounts, 10),
        topSkillNames: [...skillNames],
        topSubagentNames: [...subagentNames],
      }
    } finally {
      await fd.close()
    }
  } catch {
    return null
  }
}

const SKIP_DIRS = new Set(['subagents', 'memory', 'worktrees', 'node_modules'])
const MIN_SESSION_BYTES = 200

export async function collectSessionFiles(root: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(root, { withFileTypes: true })
    const files = await Promise.all(entries.map(async (entry) => {
      const entryPath = path.join(root, entry.name)
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) return []
        return collectSessionFiles(entryPath)
      }
      if (entry.isFile() && SESSION_EXTENSIONS.has(path.extname(entry.name))) {
        const stat = await fs.stat(entryPath).catch(() => null)
        if (stat && stat.size >= MIN_SESSION_BYTES) return [entryPath]
      }
      return []
    }))
    return files.flat()
  } catch {
    return []
  }
}

export async function readSessionDetail(agent: SessionAgent, filePath: string, pagination?: { offset?: number; limit?: number }): Promise<SessionDetail> {
  const [stat, rawText] = await Promise.all([
    fs.stat(filePath),
    fs.readFile(filePath, 'utf8').catch(() => ''),
  ])
  const rawRows = parseRows(rawText)
  const allMessages = rawRows.flatMap((row, index) => normalizeMessages(row, index))
  const projectPath = firstString(rawRows, ['cwd', 'project_path', 'projectPath']) ?? null
  const updatedAt = latestTimestamp(allMessages) ?? stat.mtime.toISOString()

  const stats = buildSessionStats({ messages: allMessages, sizeBytes: stat.size, updatedAt })

  let messages = allMessages
  let paginationMeta: SessionDetail['pagination'] = undefined
  if (pagination) {
    const total = allMessages.length
    const limit = pagination.limit ?? 50
    const offset = pagination.offset ?? Math.max(0, total - limit)
    messages = allMessages.slice(offset, offset + limit)
    paginationMeta = { offset, limit, total }
  }

  return {
    id: sessionId(agent, filePath),
    agent,
    projectPath,
    title: titleFromMessages(allMessages, filePath),
    path: filePath,
    messageCount: allMessages.length,
    updatedAt,
    sizeBytes: stat.size,
    nativeId: extractNativeId(filePath),
    toolCallCount: stats.toolCallCount,
    topToolNames: stats.tools.map((t) => t.name),
    topSkillNames: stats.skills.map((s) => s.name),
    topSubagentNames: stats.subagents.map((s) => s.name),
    messages,
    stats,
    rawPreview: rawText.slice(0, 4000),
    pagination: paginationMeta,
  }
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

function normalizeMessages(row: unknown, index: number): SessionMessage[] {
  if (!row || typeof row !== 'object') return []
  const record = row as Record<string, any>
  const rowType = String(record.type ?? '').toLowerCase()

  if (METADATA_TYPES.has(rowType)) return []

  const msg = record.message ?? {}
  const rawContent = msg.content ?? record.content ?? record.text ?? ''
  const blocks = Array.isArray(rawContent) ? rawContent : []

  const toolUseBlocks = blocks.filter((b: any) => b?.type === 'tool_use')
  const toolResultBlocks = blocks.filter((b: any) => b?.type === 'tool_result')
  const textContent = extractBlocksText(blocks)
  const results: SessionMessage[] = []
  const ts = typeof record.timestamp === 'string' ? record.timestamp : undefined

  if (textContent.trim()) {
    const msgRole = String(msg.role ?? '').toLowerCase()
    results.push({
      id: String(record.uuid ?? record.id ?? `msg-${index}`),
      role: classifyRole(rowType, msgRole),
      content: textContent,
      timestamp: ts,
    })
  }

  for (let i = 0; i < toolUseBlocks.length; i++) {
    const block = toolUseBlocks[i]
    const content = formatToolInput(block)
    if (!content) continue
    results.push({
      id: String(block.id ?? `msg-${index}-tu-${i}`),
      role: 'tool',
      content,
      timestamp: ts,
      toolName: block.name,
      toolStatus: 'ok',
      subType: 'tool_use',
    })
  }

  for (let i = 0; i < toolResultBlocks.length; i++) {
    const block = toolResultBlocks[i]
    const content = typeof block.content === 'string' ? block.content : stringifyContent(block.content)
    if (!content) continue
    results.push({
      id: String(block.tool_use_id ?? `msg-${index}-tr-${i}`),
      role: 'tool',
      content,
      timestamp: ts,
      toolStatus: block.is_error ? 'error' : 'ok',
      subType: 'tool_result',
    })
  }

  if (results.length === 0) {
    const fallback = toSingleMessage(record, rawContent, blocks, index)
    if (fallback) results.push(fallback)
  }

  return results
}

function toSingleMessage(record: Record<string, any>, rawContent: unknown, blocks: any[], index: number): SessionMessage | null {
  const rowType = String(record.type ?? record.role ?? '').toLowerCase()
  const msgRole = String(record.message?.role ?? '').toLowerCase()
  const role = classifyRole(rowType, msgRole)

  const content = blocks.length > 0 ? extractBlocksText(blocks) : stringifyContent(rawContent || record.result || record.output)

  if (!content.trim()) return null

  const skillName = inferLabel(content, /(?:skill|used skill)[:\s]+([A-Za-z0-9_.-]+)/i)
  const subagentName = inferLabel(content, /(?:subagent|agent)[:\s]+([A-Za-z0-9_.-]+)/i)
  const toolName = record.toolName ?? record.tool_name ?? record.name
  return {
    id: String(record.uuid ?? record.id ?? `msg-${index}`),
    role,
    content,
    timestamp: typeof record.timestamp === 'string' ? record.timestamp : undefined,
    toolName: typeof toolName === 'string' ? toolName : undefined,
    toolStatus: toolName ? (record.is_error || record.error ? 'error' : 'ok') : undefined,
    skillName,
    subagentName,
  }
}

function classifyRole(rowType: string, msgRole: string): SessionMessage['role'] {
  const r = msgRole || rowType
  if (r.includes('tool')) return 'tool'
  if (r.includes('user') || r === 'human') return 'user'
  if (r.includes('assistant')) return 'assistant'
  if (r.includes('system')) return 'system'
  return 'unknown'
}

function formatToolInput(block: any): string {
  const name = block.name ?? 'tool'
  const input = block.input
  if (!input || Object.keys(input).length === 0) return name
  if (typeof input.command === 'string') return `${name}: ${input.command}`
  if (typeof input.query === 'string') return `${name}: ${input.query}`
  if (typeof input.file_path === 'string') return `${name}: ${input.file_path}`
  if (typeof input.prompt === 'string') return `${name}: ${input.prompt.slice(0, 200)}`
  return `${name}: ${JSON.stringify(input).slice(0, 300)}`
}

function extractBlocksText(blocks: any[]): string {
  const parts: string[] = []
  for (const block of blocks) {
    if (typeof block === 'string') { parts.push(block); continue }
    if (block?.type === 'text' && typeof block.text === 'string') { parts.push(block.text); continue }
    if (block?.type === 'thinking' && typeof block.thinking === 'string') continue
  }
  return parts.join('\n')
}

function stringifyContent(value: unknown): string {
  if (typeof value === 'string') return value
  if (Array.isArray(value)) return extractBlocksText(value)
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

function titleFromRows(rows: unknown[], filePath: string) {
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue
    const record = row as Record<string, any>
    const role = String(record.type ?? record.role ?? '').toLowerCase()
    if (!role.includes('user') && role !== 'human') continue
    const rawContent = record.message?.content ?? record.content ?? record.text ?? ''
    const text = typeof rawContent === 'string' ? rawContent : Array.isArray(rawContent) ? rawContent.map((item: any) => typeof item === 'string' ? item : item?.text ?? '').join(' ') : ''
    const trimmed = text.trim().replace(/\s+/g, ' ').slice(0, 80)
    if (trimmed) return trimmed
  }
  return path.basename(filePath)
}

function sessionId(agent: SessionAgent, filePath: string) {
  return crypto.createHash('sha1').update(`${agent}:${path.resolve(filePath)}`).digest('hex')
}

const UUID_RE = /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i

function extractNativeId(filePath: string): string | undefined {
  const match = path.basename(filePath, path.extname(filePath)).match(UUID_RE)
  return match?.[1]
}

export function stripDetail(detail: SessionDetail): SessionSummary {
  const { messages: _messages, stats: _stats, rawPreview: _rawPreview, ...summary } = detail
  return summary
}

function sortByUpdatedDesc(a: SessionSummary, b: SessionSummary) {
  return b.updatedAt.localeCompare(a.updatedAt)
}

export function fastScanToolStats(text: string) {
  const toolCounts = new Map<string, number>()
  const skillNames = new Set<string>()
  const subagentNames = new Set<string>()

  for (const m of text.matchAll(/"tool_use".*?"name"\s*:\s*"([A-Za-z]\w*)"/g)) {
    toolCounts.set(m[1], (toolCounts.get(m[1]) ?? 0) + 1)
  }
  for (const m of text.matchAll(/"(?:function_call|custom_tool_call)"(?!_output).*?"name"\s*:\s*"([A-Za-z]\w*)"/g)) {
    toolCounts.set(m[1], (toolCounts.get(m[1]) ?? 0) + 1)
  }
  for (const m of text.matchAll(/(?:Skill|Used Skill)[:\s]+([A-Za-z0-9_.-]+)/gi)) {
    skillNames.add(m[1])
  }
  for (const m of text.matchAll(/(?:subagent|sub-agent)[:\s]+([A-Za-z0-9_.-]+)/gi)) {
    subagentNames.add(m[1])
  }

  return { toolCounts, skillNames, subagentNames }
}

function topNKeys(map: Map<string, number>, n: number): string[] {
  return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([k]) => k)
}
