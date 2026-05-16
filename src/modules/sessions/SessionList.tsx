import { Clock, FileText } from 'lucide-react'
import type { ApiSessionSummary } from '@/core/api'

export function SessionList({
  sessions,
  selectedId,
  onSelect,
}: {
  sessions: ApiSessionSummary[]
  selectedId: string | null
  onSelect: (session: ApiSessionSummary) => void
}) {
  return (
    <div className="border border-border-default bg-surface-card rounded-lg overflow-hidden">
      <div className="px-3 py-2 border-b border-border-subtle flex items-center gap-2 text-sm font-medium text-text-primary">
        <FileText size={15} />
        会话列表
        <span className="ml-auto text-2xs text-text-tertiary">{sessions.length}</span>
      </div>
      <div className="max-h-[520px] overflow-auto divide-y divide-border-subtle">
        {sessions.length === 0 ? (
          <div className="px-3 py-8 text-sm text-text-tertiary">当前筛选下没有会话</div>
        ) : sessions.map((session) => {
          const active = selectedId === session.id
          return (
            <button
              key={session.id}
              onClick={() => onSelect(session)}
              className={`w-full text-left px-3 py-3 hover:bg-surface-hover ${active ? 'bg-surface-active' : ''}`}
            >
              <div className="flex items-center gap-2">
                <span className={`px-1.5 py-0.5 rounded text-2xs ${session.agent === 'claude' ? 'bg-orange-50 text-orange-700' : 'bg-blue-50 text-blue-700'}`}>
                  {session.agent}
                </span>
                <span className="text-xs font-medium text-text-primary truncate">{session.title}</span>
              </div>
              <div className="mt-1 text-2xs text-text-tertiary truncate">{session.projectPath ?? '未知项目'}</div>
              <div className="mt-1.5 flex items-center gap-3 text-2xs text-text-tertiary">
                <span>{session.messageCount} 消息</span>
                <span className="inline-flex items-center gap-1"><Clock size={10} />{new Date(session.updatedAt).toLocaleString()}</span>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
