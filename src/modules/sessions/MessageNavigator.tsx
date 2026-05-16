import { ListTree } from 'lucide-react'
import type { ApiSessionMessage, ApiSessionRole } from '@/core/api'

export function MessageNavigator({
  messages,
  roleFilter,
  onRoleFilter,
  onJump,
}: {
  messages: ApiSessionMessage[]
  roleFilter: ApiSessionRole | 'all'
  onRoleFilter: (role: ApiSessionRole | 'all') => void
  onJump: (id: string) => void
}) {
  const roles: Array<ApiSessionRole | 'all'> = ['all', 'user', 'assistant', 'tool', 'system', 'unknown']
  const anchors = messages.filter((message) => message.role === 'user' || message.role === 'assistant' || message.role === 'tool')

  return (
    <div className="border border-border-default bg-surface-card rounded-lg p-3">
      <div className="flex items-center gap-2 text-sm font-medium text-text-primary mb-3">
        <ListTree size={15} />
        消息导航
      </div>
      <div className="flex flex-wrap gap-1.5 mb-3">
        {roles.map((role) => (
          <button
            key={role}
            onClick={() => onRoleFilter(role)}
            className={`px-2 py-1 rounded-md text-2xs ${roleFilter === role ? 'bg-accent-blue text-white' : 'bg-surface-base text-text-secondary hover:bg-surface-hover'}`}
          >
            {role === 'all' ? '全部' : role}
          </button>
        ))}
      </div>
      <div className="max-h-[220px] overflow-auto space-y-1">
        {anchors.slice(0, 80).map((message, index) => (
          <button
            key={message.id}
            onClick={() => onJump(message.id)}
            className="w-full text-left px-2 py-1.5 rounded-md hover:bg-surface-hover text-2xs text-text-secondary"
          >
            <span className="text-text-tertiary mr-1">{index + 1}.</span>
            <span className="uppercase text-text-tertiary mr-1">{message.role}</span>
            <span className="truncate">{message.toolName ?? message.content.slice(0, 48)}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
