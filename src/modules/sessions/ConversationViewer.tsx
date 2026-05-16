import { ArrowLeft, ArrowRight, Bot, ChevronDown, ChevronUp, Copy, Trash2, User, Wrench } from 'lucide-react'
import { useRef, useState } from 'react'
import type { ApiSessionDetail, ApiSessionMessage, ApiSessionRole } from '@/core/api'
import { useAppStore } from '@/store'

const COLLAPSE_THRESHOLD = 320
const COLLAPSED_PREVIEW_LENGTH = 220

export function ConversationViewer({
  detail,
  loading,
  roleFilter,
  showTools,
  onRoleFilter,
  onToggleTools,
  onDelete,
  onCopyPath,
  onBack,
  onLoadPage,
}: {
  detail: ApiSessionDetail | null
  loading: boolean
  roleFilter: ApiSessionRole | 'all'
  showTools: boolean
  onRoleFilter: (role: ApiSessionRole | 'all') => void
  onToggleTools: () => void
  onDelete: () => void
  onCopyPath: () => void
  onBack: () => void
  onLoadPage: (offset: number) => void
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const { pushToast } = useAppStore()

  if (loading && !detail) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-text-tertiary">
        加载会话中
      </div>
    )
  }

  if (!detail) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-text-tertiary">
        选择一个会话查看消息
      </div>
    )
  }

  const pagination = detail.pagination
  const canLoadPrev = pagination && pagination.offset > 0
  const canLoadNext = pagination && (pagination.offset + pagination.limit < pagination.total)

  const visibleMessages = detail.messages.filter((msg) => {
    if (!showTools && msg.role === 'tool') return false
    if (roleFilter !== 'all' && msg.role !== roleFilter) return false
    return true
  })

  const resumeCmd = detail.agent === 'claude' && detail.nativeId
    ? `claude --resume ${detail.nativeId}`
    : null

  const copyText = async (text: string, label: string) => {
    await navigator.clipboard?.writeText(text)
    pushToast({ kind: 'success', message: `${label}已复制` })
  }

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div className="shrink-0 px-4 py-3 border-b border-border-default bg-surface-card">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-1 rounded-md hover:bg-surface-hover text-text-tertiary">
            <ArrowLeft size={16} />
          </button>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className={`px-1.5 py-0.5 rounded text-2xs ${detail.agent === 'claude' ? 'bg-orange-50 text-orange-700' : 'bg-blue-50 text-blue-700'}`}>
                {detail.agent}
              </span>
              <h2 className="text-sm font-semibold text-text-primary truncate">{detail.title}</h2>
            </div>
            <div className="mt-0.5 text-2xs text-text-tertiary truncate">{detail.path}</div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button onClick={onToggleTools} className={`px-2 py-1 rounded-md text-2xs ${showTools ? 'bg-accent-blue text-white' : 'bg-surface-base text-text-secondary hover:bg-surface-hover'}`}>
              工具
            </button>
            <RoleFilterChips value={roleFilter} onChange={onRoleFilter} />
            <button onClick={onDelete} className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-red-50 text-2xs text-red-700 hover:bg-red-100" title="删除">
              <Trash2 size={11} />
            </button>
          </div>
        </div>

        {/* Copy actions row */}
        <div className="mt-2 flex items-center gap-2 flex-wrap">
          {detail.projectPath && (
            <CopyChip label="项目路径" value={detail.projectPath} onCopy={copyText} />
          )}
          <CopyChip label="文件路径" value={detail.path} onCopy={copyText} />
          {detail.nativeId && (
            <CopyChip label="Session ID" value={detail.nativeId} onCopy={copyText} />
          )}
          {resumeCmd && (
            <CopyChip label="Resume 命令" value={resumeCmd} onCopy={copyText} />
          )}
          {pagination && (
            <span className="ml-auto text-2xs text-text-tertiary">
              消息 {pagination.offset + 1}–{Math.min(pagination.offset + pagination.limit, pagination.total)} / {pagination.total}
            </span>
          )}
        </div>
      </div>

      {/* Conversation area */}
      <div ref={scrollRef} className="flex-1 overflow-auto">
        <div className="max-w-[800px] mx-auto py-4 px-4 space-y-1">
          {canLoadPrev && (
            <button
              onClick={() => onLoadPage(Math.max(0, pagination!.offset - pagination!.limit))}
              disabled={loading}
              className="w-full py-2 mb-2 text-xs text-accent-blue hover:underline disabled:opacity-50"
            >
              ← 加载更早消息
            </button>
          )}
          {visibleMessages.map((msg) => (
            <ChatBubble key={msg.id} message={msg} />
          ))}
          {canLoadNext && (
            <button
              onClick={() => onLoadPage(pagination!.offset + pagination!.limit)}
              disabled={loading}
              className="w-full py-2 mt-2 text-xs text-accent-blue hover:underline disabled:opacity-50"
            >
              加载更多消息 →
            </button>
          )}
          {visibleMessages.length === 0 && (
            <div className="text-center text-sm text-text-tertiary py-12">
              {detail.messages.length === 0 ? '空会话' : '当前过滤条件下没有消息'}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function CopyChip({ label, value, onCopy }: { label: string; value: string; onCopy: (text: string, label: string) => void }) {
  return (
    <button
      onClick={() => onCopy(value, label)}
      className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-surface-base text-2xs text-text-secondary hover:bg-surface-hover border border-border-subtle"
      title={value}
    >
      <Copy size={10} />
      {label}
    </button>
  )
}

function RoleFilterChips({ value, onChange }: { value: ApiSessionRole | 'all'; onChange: (v: ApiSessionRole | 'all') => void }) {
  const roles: Array<{ key: ApiSessionRole | 'all'; label: string }> = [
    { key: 'all', label: '全部' },
    { key: 'user', label: '用户' },
    { key: 'assistant', label: 'AI' },
  ]
  return (
    <div className="flex gap-0.5 p-0.5 bg-surface-base rounded-md">
      {roles.map((r) => (
        <button
          key={r.key}
          onClick={() => onChange(r.key)}
          className={`px-1.5 py-0.5 rounded text-2xs transition-colors ${value === r.key ? 'bg-accent-blue text-white' : 'text-text-tertiary hover:text-text-secondary'}`}
        >
          {r.label}
        </button>
      ))}
    </div>
  )
}

function ChatBubble({ message }: { message: ApiSessionMessage }) {
  const canCollapse = message.content.length > COLLAPSE_THRESHOLD
  const [collapsed, setCollapsed] = useState(() => canCollapse)

  const isUser = message.role === 'user'
  const isTool = message.role === 'tool'
  const isToolUse = message.subType === 'tool_use'
  const isToolResult = message.subType === 'tool_result'

  const toggleCollapsed = () => {
    if (canCollapse) setCollapsed((value) => !value)
  }
  const content = collapsed ? message.content.slice(0, COLLAPSED_PREVIEW_LENGTH) + '...' : message.content

  if (isTool) {
    return (
      <div id={`msg-${message.id}`} className="my-1">
        <div className={`mx-8 border rounded-lg px-3 py-2 ${
          isToolUse
            ? 'border-blue-200/60 bg-blue-50/30'
            : message.toolStatus === 'error'
              ? 'border-red-200/60 bg-red-50/30'
              : 'border-amber-200/60 bg-amber-50/30'
        }`}>
          <div className="flex items-center gap-2 text-2xs mb-1">
            {isToolUse ? (
              <>
                <ArrowRight size={11} className="text-blue-500" />
                <span className="font-medium text-blue-700">{message.toolName ?? 'tool'}</span>
                <span className="text-blue-400">调用</span>
              </>
            ) : (
              <>
                <Wrench size={11} className="text-amber-600" />
                <span className="font-medium text-amber-700">{message.toolName ?? '结果'}</span>
                {message.toolStatus === 'error' && <span className="text-red-600 font-medium">失败</span>}
              </>
            )}
            {message.timestamp && <span className="ml-auto text-text-tertiary">{formatTime(message.timestamp)}</span>}
            {canCollapse && (
              <button
                onClick={toggleCollapsed}
                className="ml-1 inline-flex items-center gap-0.5 text-text-tertiary hover:text-text-primary"
                title={collapsed ? '展开完整内容' : '收起内容'}
              >
                {collapsed ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
                <span>{collapsed ? '展开' : '收起'}</span>
              </button>
            )}
          </div>
          <pre
            onClick={toggleCollapsed}
            title={canCollapse ? (collapsed ? '点击展开完整内容' : '点击收起内容') : undefined}
            className={`whitespace-pre-wrap break-words text-2xs leading-relaxed font-mono ${canCollapse ? 'cursor-pointer' : ''} ${
            isToolUse ? 'text-blue-900/70' : message.toolStatus === 'error' ? 'text-red-900/70' : 'text-amber-900/70'
          }`}
          >
            {content}
          </pre>
        </div>
      </div>
    )
  }

  return (
    <div id={`msg-${message.id}`} className={`flex gap-2.5 my-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      {/* Avatar */}
      <div className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center ${
        isUser ? 'bg-blue-100 text-blue-600' : 'bg-gradient-to-br from-orange-100 to-amber-100 text-orange-600'
      }`}>
        {isUser ? <User size={14} /> : <Bot size={14} />}
      </div>

      {/* Bubble */}
      <div className={`max-w-[85%] min-w-0 ${isUser ? 'items-end' : ''}`}>
        <div className={`rounded-2xl px-4 py-2.5 ${
          isUser
            ? 'bg-accent-blue text-white rounded-tr-md'
            : 'bg-surface-card border border-border-default text-text-primary rounded-tl-md'
        }`}>
          <pre
            onClick={toggleCollapsed}
            title={canCollapse ? (collapsed ? '点击展开完整内容' : '点击收起内容') : undefined}
            className={`whitespace-pre-wrap break-words text-[13px] leading-relaxed font-sans ${canCollapse ? 'cursor-pointer' : ''}`}
          >
            {content}
          </pre>
        </div>
        <div className={`mt-1 flex items-center gap-2 text-2xs text-text-tertiary ${isUser ? 'justify-end' : ''}`}>
          {message.skillName && <span className="text-purple-500">技能: {message.skillName}</span>}
          {message.subagentName && <span className="text-teal-500">子代理: {message.subagentName}</span>}
          {message.timestamp && <span>{formatTime(message.timestamp)}</span>}
          {canCollapse && (
            <button
              onClick={toggleCollapsed}
              className={`inline-flex items-center gap-0.5 hover:text-text-primary ${isUser ? 'ml-auto' : ''}`}
              title={collapsed ? '展开完整内容' : '收起内容'}
            >
              {collapsed ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
              {collapsed ? '展开' : '收起'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function formatTime(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
  } catch {
    return ''
  }
}
