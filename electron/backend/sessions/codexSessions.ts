import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { buildSessionStats } from './sessionAnalytics'
import { collectSessionFiles, fastScanToolStats } from './claudeSessions'
import type { SessionDetail, SessionMessage, SessionSummary } from './sessionTypes'

const SUMMARY_PEEK_BYTES = 8192

export function codexSessionRoot(homeDir = os.homedir()) {
  return path.join(homeDir, '.codex', 'sessions')
}

export async function listCodexSessions(homeDir?: string): Promise<SessionSummary[]> {
  const files = await collectSessionFiles(codexSessionRoot(homeDir))
  const summaries = await Promise.all(files.map(readCodexSummary))
  return summaries.filter(Boolean).sort((a, b) => b!.updatedAt.localeCompare(a!.updatedAt)) as SessionSummary[]
}

export async function readCodexSession(filePath: string, pagination?: { offset?: number; limit?: number }): Promise<SessionDetail> {
  const [stat, rawText] = await Promise.all([
    fs.stat(filePath),
    fs.readFile(filePath, 'utf8').catch(() => ''),
  ])
  const rows = parseRows(rawText)
  const meta = extractMeta(rows)
  const allMessages = rows.flatMap((row, i) => normalizeCodexRow(row, i))
  const updatedAt = lastTimestamp(rows) ?? stat.mtime.toISOString()
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
    id: sessionId(filePath),
    agent: 'codex',
    projectPath: meta.cwd ? path.normalize(meta.cwd) : null,
    title: meta.title || titleFromMessages(allMessages, filePath),
    path: filePath,
    messageCount: allMessages.length,
    updatedAt,
    sizeBytes: stat.size,
    nativeId: meta.id,
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

async function readCodexSummary(filePath: string): Promise<SessionSummary | null> {
  try {
    const stat = await fs.stat(filePath)
    const fullText = await fs.readFile(filePath, 'utf8').catch(() => '')
    if (!fullText) return null

    const meta = extractMetaFast(fullText)
    const messageCount = countConversationRows(fullText)

    const peekRows = parseRows(fullText.slice(0, 64000))
    const title = meta.title || titleFromPeek(peekRows, filePath)

    const { toolCounts, skillNames, subagentNames } = fastScanToolStats(fullText)
    const toolCallCount = [...toolCounts.values()].reduce((a, b) => a + b, 0)
    const topToolNames = [...toolCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([k]) => k)

    return {
      id: sessionId(filePath),
      agent: 'codex',
      projectPath: meta.cwd ? path.normalize(meta.cwd) : null,
      title,
      path: filePath,
      messageCount,
      updatedAt: stat.mtime.toISOString(),
      sizeBytes: stat.size,
      nativeId: meta.id,
      toolCallCount,
      topToolNames,
      topSkillNames: [...skillNames],
      topSubagentNames: [...subagentNames],
    }
  } catch {
    return null
  }
}

interface CodexMeta {
  id?: string
  cwd?: string
  title?: string
}

function extractMetaFast(text: string): CodexMeta {
  const meta: CodexMeta = {}
  const cwdMatch = text.match(/"session_meta".*?"cwd"\s*:\s*"([^"]+)"/)
  if (cwdMatch) meta.cwd = cwdMatch[1]
  const idMatch = text.match(/"session_meta".*?"id"\s*:\s*"([^"]+)"/)
  if (idMatch) meta.id = idMatch[1]
  const titleMatch = text.match(/"user_message".*?"message"\s*:\s*"([^"]{1,80})/)
  if (titleMatch) meta.title = titleMatch[1].replace(/\\n/g, ' ').trim()
  return meta
}

function extractMeta(rows: any[]): CodexMeta {
  const meta: CodexMeta = {}
  for (const row of rows) {
    if (row?.type === 'session_meta') {
      const p = row.payload ?? {}
      meta.id = p.id
      meta.cwd = p.cwd
    }
    if (row?.type === 'turn_context') {
      const p = row.payload ?? {}
      if (!meta.cwd && p.cwd) meta.cwd = p.cwd
    }
    if (row?.type === 'event_msg') {
      const p = row.payload ?? {}
      if (p.type === 'user_message' && !meta.title) {
        const text = typeof p.message === 'string' ? p.message : ''
        meta.title = text.trim().replace(/\s+/g, ' ').slice(0, 80)
      }
    }
  }
  return meta
}

function normalizeCodexRow(row: any, index: number): SessionMessage[] {
  if (!row || typeof row !== 'object') return []
  const ts = typeof row.timestamp === 'string' ? row.timestamp : undefined

  if (row.type === 'event_msg') {
    const p = row.payload ?? {}
    if (p.type === 'user_message') {
      const text = typeof p.message === 'string' ? p.message : ''
      if (!text.trim()) return []
      return [{ id: `msg-${index}`, role: 'user', content: text, timestamp: ts }]
    }
    if (p.type === 'agent_message') {
      const text = typeof p.message === 'string' ? p.message : ''
      if (!text.trim()) return []
      return [{ id: `msg-${index}`, role: 'assistant', content: text, timestamp: ts }]
    }
    return []
  }

  if (row.type === 'response_item') {
    const p = row.payload ?? {}

    if (p.type === 'message') {
      const role = p.role === 'user' ? 'user' as const
        : p.role === 'assistant' ? 'assistant' as const
        : p.role === 'developer' ? 'system' as const
        : 'unknown' as const
      const content = extractResponseContent(p.content)
      if (!content.trim()) return []
      if (role === 'system') return []
      return [{ id: String(p.id ?? `msg-${index}`), role, content, timestamp: ts }]
    }

    if (p.type === 'function_call') {
      const name = p.name ?? 'tool'
      const args = typeof p.arguments === 'string' ? p.arguments : ''
      const input = tryParseInput(args)
      return [{
        id: String(p.call_id ?? `msg-${index}`),
        role: 'tool',
        content: input,
        timestamp: ts,
        toolName: name,
        toolStatus: 'ok',
        subType: 'tool_use',
      }]
    }

    if (p.type === 'function_call_output') {
      const output = typeof p.output === 'string' ? p.output : JSON.stringify(p.output ?? '')
      if (!output.trim()) return []
      return [{
        id: String(p.call_id ?? `msg-${index}-out`),
        role: 'tool',
        content: output,
        timestamp: ts,
        toolStatus: 'ok',
        subType: 'tool_result',
      }]
    }

    if (p.type === 'custom_tool_call') {
      const name = p.name ?? 'tool'
      const input = typeof p.input === 'string' ? p.input.slice(0, 500) : JSON.stringify(p.input ?? '').slice(0, 500)
      return [{
        id: String(p.call_id ?? `msg-${index}`),
        role: 'tool',
        content: `${name}: ${input}`,
        timestamp: ts,
        toolName: name,
        toolStatus: 'ok',
        subType: 'tool_use',
      }]
    }

    if (p.type === 'custom_tool_call_output') {
      const output = typeof p.output === 'string' ? p.output : JSON.stringify(p.output ?? '')
      if (!output.trim()) return []
      return [{
        id: String(p.call_id ?? `msg-${index}-out`),
        role: 'tool',
        content: output,
        timestamp: ts,
        toolStatus: 'ok',
        subType: 'tool_result',
      }]
    }

    return []
  }

  return []
}

function extractResponseContent(content: any): string {
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''
  return content
    .map((block: any) => {
      if (typeof block === 'string') return block
      if (block?.type === 'input_text' && typeof block.text === 'string') return block.text
      if (block?.type === 'output_text' && typeof block.text === 'string') return block.text
      return ''
    })
    .filter(Boolean)
    .join('\n')
}

function tryParseInput(args: string): string {
  try {
    const parsed = JSON.parse(args)
    if (typeof parsed.cmd === 'string') return parsed.cmd
    if (typeof parsed.command === 'string') return parsed.command
    if (typeof parsed.query === 'string') return parsed.query
    if (typeof parsed.file_path === 'string') return parsed.file_path
    return args.slice(0, 500)
  } catch {
    return args.slice(0, 500)
  }
}

function titleFromMessages(messages: SessionMessage[], filePath: string): string {
  const firstUser = messages.find((m) => m.role === 'user' && m.content.trim())
  return firstUser?.content.trim().replace(/\s+/g, ' ').slice(0, 80) || path.basename(filePath)
}

function titleFromPeek(rows: any[], filePath: string): string {
  for (const row of rows) {
    if (row?.type === 'event_msg' && row.payload?.type === 'user_message') {
      const text = typeof row.payload.message === 'string' ? row.payload.message : ''
      const trimmed = text.trim().replace(/\s+/g, ' ').slice(0, 80)
      if (trimmed) return trimmed
    }
    if (row?.type === 'response_item' && row.payload?.type === 'message' && row.payload?.role === 'user') {
      const content = extractResponseContent(row.payload.content)
      const trimmed = content.trim().replace(/\s+/g, ' ').slice(0, 80)
      if (trimmed) return trimmed
    }
  }
  return path.basename(filePath)
}

function countConversationRows(text: string): number {
  let count = 0
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue
    if (line.includes('"user_message"') || line.includes('"agent_message"') || line.includes('"function_call"')) count++
  }
  return count
}

function lastTimestamp(rows: any[]): string | undefined {
  for (let i = rows.length - 1; i >= 0; i--) {
    const ts = rows[i]?.timestamp
    if (typeof ts === 'string') return ts
  }
  return undefined
}

function parseRows(text: string): any[] {
  if (!text.trim()) return []
  return text.split(/\r?\n/).map((line) => {
    try { return JSON.parse(line.trim()) } catch { return null }
  }).filter(Boolean)
}

function sessionId(filePath: string) {
  return crypto.createHash('sha1').update(`codex:${path.resolve(filePath)}`).digest('hex')
}
