import { Copy, Trash2 } from 'lucide-react'
import type { ApiSessionDetail, ApiSessionMessage, ApiSessionRole } from '@/core/api'
import { SessionStatsPanel } from './SessionAnalytics'
import { MessageNavigator } from './MessageNavigator'

export function SessionDetail({
  detail,
  loading,
  roleFilter,
  showTools,
  onRoleFilter,
  onToggleTools,
  onDelete,
  onCopyPath,
}: {
  detail: ApiSessionDetail | null
  loading: boolean
  roleFilter: ApiSessionRole | 'all'
  showTools: boolean
  onRoleFilter: (role: ApiSessionRole | 'all') => void
  onToggleTools: () => void
  onDelete: () => void
  onCopyPath: () => void
}) {
  if (loading) {
    return <div className="border border-border-default bg-surface-card rounded-lg p-6 text-sm text-text-tertiary">加载会话中</div>
  }

  if (!detail) {
    return <div className="border border-border-default bg-surface-card rounded-lg p-6 text-sm text-text-tertiary">选择一个会话查看消息</div>
  }

  const visibleMessages = detail.messages.filter((message) => {
    if (!showTools && message.role === 'tool') return false
    if (roleFilter !== 'all' && message.role !== roleFilter) return false
    return true
  })

  const jumpTo = (id: string) => document.getElementById(`message-${id}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' })

  return (
    <div className="grid grid-cols-[1fr_220px] gap-4 min-w-0">
      <div className="border border-border-default bg-surface-card rounded-lg overflow-hidden min-w-0">
        <div className="px-4 py-3 border-b border-border-subtle">
          <div className="flex items-center gap-2">
            <span className={`px-1.5 py-0.5 rounded text-2xs ${detail.agent === 'claude' ? 'bg-orange-50 text-orange-700' : 'bg-blue-50 text-blue-700'}`}>
              {detail.agent}
            </span>
            <h2 className="text-sm font-semibold text-text-primary truncate">{detail.title}</h2>
          </div>
          <div className="mt-1 text-2xs text-text-tertiary truncate">{detail.path}</div>
          <div className="mt-3 flex items-center gap-2">
            <button onClick={onCopyPath} className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-surface-base text-2xs text-text-secondary hover:bg-surface-hover">
              <Copy size={12} />
              复制路径
            </button>
            <button onClick={onToggleTools} className={`px-2 py-1 rounded-md text-2xs ${showTools ? 'bg-accent-blue text-white' : 'bg-surface-base text-text-secondary hover:bg-surface-hover'}`}>
              工具消息
            </button>
            <button onClick={onDelete} className="ml-auto inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-red-50 text-2xs text-red-700 hover:bg-red-100">
              <Trash2 size={12} />
              删除到回收区
            </button>
          </div>
        </div>
        <div className="h-[620px] overflow-auto p-4 space-y-3">
          {visibleMessages.map((message) => <MessageBubble key={message.id} message={message} />)}
        </div>
      </div>
      <div className="space-y-4">
        <SessionStatsPanel stats={detail.stats} />
        <MessageNavigator messages={detail.messages} roleFilter={roleFilter} onRoleFilter={onRoleFilter} onJump={jumpTo} />
      </div>
    </div>
  )
}

function MessageBubble({ message }: { message: ApiSessionMessage }) {
  const tone = {
    user: 'border-blue-100 bg-blue-50/50',
    assistant: 'border-border-subtle bg-surface-base',
    tool: 'border-amber-100 bg-amber-50/50',
    system: 'border-border-subtle bg-surface-base',
    unknown: 'border-border-subtle bg-surface-base',
  }[message.role]

  return (
    <div id={`message-${message.id}`} className={`border ${tone} rounded-lg p-3`}>
      <div className="flex items-center gap-2 text-2xs text-text-tertiary mb-2">
        <span className="uppercase">{message.role}</span>
        {message.toolName && <span>{message.toolName}</span>}
        {message.toolStatus === 'error' && <span className="text-red-600">失败</span>}
        {message.timestamp && <span className="ml-auto">{new Date(message.timestamp).toLocaleString()}</span>}
      </div>
      <pre className="whitespace-pre-wrap break-words text-xs leading-relaxed text-text-primary font-sans">{message.content || '(空消息)'}</pre>
    </div>
  )
}
