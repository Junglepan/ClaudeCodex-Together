import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { buildSessionStats } from './sessionAnalytics'
import type { SessionAgent, SessionDetail, SessionMessage, SessionSummary, TokenUsage } from './sessionTypes'
import { emptyTokenUsage } from './tokenUtils'

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

      const scan = fastScanToolStats(fullScan)
      const scale = stat.size > SCAN_LIMIT ? stat.size / SCAN_LIMIT : 1
      const toolCallCount = Math.round([...scan.toolCounts.values()].reduce((a, b) => a + b, 0) * scale)
      const topTools = topCounts(scan.toolCounts, 10, scale)
      const topModels = topCounts(scan.modelCounts, 5, scale)

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
        topToolNames: topTools.map((t) => t.name),
        topTools,
        topSkillNames: [...scan.skillNames],
        topSubagentNames: [...scan.subagentNames],
        tokenUsage: scaleTokenUsage(scan.tokenUsage, scale),
        topModelNames: topModels.map((m) => m.name),
        topModels,
        totalDurationMs: Math.round(scan.totalDurationMs * scale),
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
    topTools: stats.tools.map((t) => ({ name: t.name, count: t.count })),
    topSkillNames: stats.skills.map((s) => s.name),
    topSubagentNames: stats.subagents.map((s) => s.name),
    tokenUsage: stats.tokenUsage,
    topModelNames: stats.models.map((m) => m.name),
    topModels: stats.models,
    totalDurationMs: stats.totalDurationMs,
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

  // Extract turn_duration from system messages as invisible duration markers
  if (rowType === 'system' && record.subtype === 'turn_duration' && typeof record.durationMs === 'number') {
    return [{
      id: String(record.uuid ?? `msg-${index}-dur`),
      role: 'system',
      content: '',
      timestamp: typeof record.timestamp === 'string' ? record.timestamp : undefined,
      durationMs: record.durationMs,
    }]
  }

  const msg = record.message ?? {}
  const rawContent = msg.content ?? record.content ?? record.text ?? ''
  const blocks = Array.isArray(rawContent) ? rawContent : []
  const model = typeof msg.model === 'string' && msg.model !== '<synthetic>' ? msg.model : undefined
  const msgTokenUsage = extractTokenUsage(msg.usage)

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
      model,
      tokenUsage: msgTokenUsage,
    })
  }

  for (let i = 0; i < toolUseBlocks.length; i++) {
    const block = toolUseBlocks[i]
    const content = formatToolInput(block)
    if (!content) continue
    const input = block.input ?? {}
    const skillName = block.name === 'Skill' && typeof input.skill === 'string' ? input.skill : undefined
    const subagentName = block.name === 'Agent' && typeof input.subagent_type === 'string' ? input.subagent_type : undefined
    results.push({
      id: String(block.id ?? `msg-${index}-tu-${i}`),
      role: 'tool',
      content,
      timestamp: ts,
      toolName: block.name,
      toolStatus: 'ok',
      subType: 'tool_use',
      skillName,
      subagentName,
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

  const toolName = record.toolName ?? record.tool_name ?? record.name
  return {
    id: String(record.uuid ?? record.id ?? `msg-${index}`),
    role,
    content,
    timestamp: typeof record.timestamp === 'string' ? record.timestamp : undefined,
    toolName: typeof toolName === 'string' ? toolName : undefined,
    toolStatus: toolName ? (record.is_error || record.error ? 'error' : 'ok') : undefined,
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

export interface FastScanResult {
  toolCounts: Map<string, number>
  skillNames: Set<string>
  subagentNames: Set<string>
  modelCounts: Map<string, number>
  tokenUsage: TokenUsage
  totalDurationMs: number
}

export function fastScanToolStats(text: string): FastScanResult {
  const toolCounts = new Map<string, number>()
  const skillNames = new Set<string>()
  const subagentNames = new Set<string>()
  const modelCounts = new Map<string, number>()
  const tokenUsage: TokenUsage = { inputTokens: 0, outputTokens: 0, cacheCreationTokens: 0, cacheReadTokens: 0 }
  let totalDurationMs = 0

  // Claude: tool_use blocks — "type":"tool_use"..."name":"ToolName"
  for (const m of text.matchAll(/"tool_use".*?"name"\s*:\s*"([A-Za-z]\w*)"/g)) {
    toolCounts.set(m[1], (toolCounts.get(m[1]) ?? 0) + 1)
  }
  // Codex: function_call / custom_tool_call blocks
  for (const m of text.matchAll(/"(?:function_call|custom_tool_call)"(?!_output).*?"name"\s*:\s*"([A-Za-z]\w*)"/g)) {
    toolCounts.set(m[1], (toolCounts.get(m[1]) ?? 0) + 1)
  }
  // Skills: Skill tool call with "skill":"name" in input
  for (const m of text.matchAll(/"name"\s*:\s*"Skill".*?"skill"\s*:\s*"([^"]+)"/g)) {
    skillNames.add(m[1])
  }
  // Subagents: Agent tool call with "subagent_type":"name" in input
  for (const m of text.matchAll(/"subagent_type"\s*:\s*"([^"]+)"/g)) {
    subagentNames.add(m[1])
  }
  // Token/duration: per-line scan, first match only to avoid nested duplicates
  // Claude: usage.input_tokens (skip iterations[].input_tokens)
  // Codex: total_token_usage.input_tokens is cumulative — take last occurrence only
  const isCodex = text.includes('"session_meta"') || text.includes('"event_msg"')
  // Models: Claude uses global regex; Codex uses per-line JSON.parse on turn_context
  const modelRe = /"model"\s*:\s*"(claude-[^"]+|o[0-9]+-[^"]+|gpt-[^"]+)"/g
  if (!isCodex) {
    for (const m of text.matchAll(modelRe)) {
      modelCounts.set(m[1], (modelCounts.get(m[1]) ?? 0) + 1)
    }
  }
  const inputTokenRe = /"input_tokens"\s*:\s*(\d+)/
  const outputTokenRe = /"output_tokens"\s*:\s*(\d+)/
  const cacheCreationRe = /"cache_creation_input_tokens"\s*:\s*(\d+)/
  const cacheReadRe = /"cache_read_input_tokens"\s*:\s*(\d+)/
  const durationRe = /"turn_duration".*?"durationMs"\s*:\s*(\d+)/
  // For Codex, track last total_token_usage instead of summing
  const codexTotalRe = /"total_token_usage".*?"input_tokens"\s*:\s*(\d+).*?"output_tokens"\s*:\s*(\d+)/
  let codexLastInput = 0
  let codexLastOutput = 0
  let codexSawIncrementalUsage = false

  for (const line of text.split('\n')) {
    // Codex: extract model from turn_context via JSON.parse (avoid double-counting nested model fields)
    if (isCodex && line.includes('"turn_context"')) {
      const row = parseJson(line)
      const model = typeof row?.payload?.model === 'string' ? row.payload.model : undefined
      if (model) modelCounts.set(model, (modelCounts.get(model) ?? 0) + 1)
      continue
    }
    if (isCodex && line.includes('last_token_usage')) {
      const row = parseJson(line)
      const usage = row?.payload?.info?.last_token_usage
      if (usage && typeof usage === 'object') {
        tokenUsage.inputTokens += typeof usage.input_tokens === 'number' ? usage.input_tokens : 0
        tokenUsage.outputTokens += typeof usage.output_tokens === 'number' ? usage.output_tokens : 0
        tokenUsage.cacheCreationTokens += typeof usage.cache_creation_input_tokens === 'number' ? usage.cache_creation_input_tokens : 0
        tokenUsage.cacheReadTokens += typeof usage.cached_input_tokens === 'number'
          ? usage.cached_input_tokens
          : typeof usage.cache_read_input_tokens === 'number'
            ? usage.cache_read_input_tokens
            : 0
        codexSawIncrementalUsage = true
      }
      continue
    }
    if (isCodex && line.includes('total_token_usage')) {
      const m = line.match(codexTotalRe)
      if (m) { codexLastInput = Number(m[1]); codexLastOutput = Number(m[2]) }
      continue
    }
    const inputMatch = line.match(inputTokenRe)
    if (inputMatch) tokenUsage.inputTokens += Number(inputMatch[1])
    const outputMatch = line.match(outputTokenRe)
    if (outputMatch) tokenUsage.outputTokens += Number(outputMatch[1])
    const cacheCreateMatch = line.match(cacheCreationRe)
    if (cacheCreateMatch) tokenUsage.cacheCreationTokens += Number(cacheCreateMatch[1])
    const cacheReadMatch = line.match(cacheReadRe)
    if (cacheReadMatch) tokenUsage.cacheReadTokens += Number(cacheReadMatch[1])
    const durMatch = line.match(durationRe)
    if (durMatch) totalDurationMs += Number(durMatch[1])
  }
  if (isCodex && !codexSawIncrementalUsage) {
    tokenUsage.inputTokens = codexLastInput
    tokenUsage.outputTokens = codexLastOutput
  }
  if (!isCodex) {
    tokenUsage.inputTokens += tokenUsage.cacheCreationTokens + tokenUsage.cacheReadTokens
  }

  return { toolCounts, skillNames, subagentNames, modelCounts, tokenUsage, totalDurationMs }
}

function topCounts(map: Map<string, number>, n: number, scale = 1): Array<{ name: string; count: number }> {
  return [...map.entries()]
    .map(([name, count]) => ({ name, count: Math.round(count * scale) }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, n)
}

function extractTokenUsage(usage: any): TokenUsage | undefined {
  if (!usage || typeof usage !== 'object') return undefined
  const rawInput = typeof usage.input_tokens === 'number' ? usage.input_tokens : 0
  const output = typeof usage.output_tokens === 'number' ? usage.output_tokens : 0
  const cacheCreation = typeof usage.cache_creation_input_tokens === 'number' ? usage.cache_creation_input_tokens : 0
  const cacheRead = typeof usage.cache_read_input_tokens === 'number' ? usage.cache_read_input_tokens : 0
  const totalInput = rawInput + cacheCreation + cacheRead
  if (totalInput === 0 && output === 0) return undefined
  return {
    inputTokens: totalInput,
    outputTokens: output,
    cacheCreationTokens: cacheCreation,
    cacheReadTokens: cacheRead,
  }
}

function scaleTokenUsage(usage: TokenUsage, scale: number): TokenUsage {
  if (scale <= 1) return usage
  return {
    inputTokens: Math.round(usage.inputTokens * scale),
    outputTokens: Math.round(usage.outputTokens * scale),
    cacheCreationTokens: Math.round(usage.cacheCreationTokens * scale),
    cacheReadTokens: Math.round(usage.cacheReadTokens * scale),
  }
}
