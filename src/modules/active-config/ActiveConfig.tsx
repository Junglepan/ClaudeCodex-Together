import { CheckCircle, Circle } from 'lucide-react'
import { agentRegistry } from '@/core/agent-registry'
import { useAgents } from '@/hooks/useAgents'
import { useAppStore } from '@/store'
import type { ApiConfigFile } from '@/core/api'
import { TableSkeleton } from '@/components/ui/Skeleton'

export function ActiveConfig() {
  const { filesByAgent } = useAgents()
  const { loading } = useAppStore()
  const agents = agentRegistry.getAll()

  return (
    <div className="flex-1 overflow-auto p-6 animate-fade-in">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-text-primary">当前生效</h1>
        <p className="mt-1 text-sm text-text-secondary">
          列出当前项目中实际存在并生效的配置文件
        </p>
      </div>

      <div className="space-y-4">
        {agents.map((agent) => {
          const files = filesByAgent[agent.id] ?? []
          const active = files.filter((f) => f.exists)
          const inactive = files.filter((f) => !f.exists)
          const isLoading = loading && files.length === 0

          return (
            <div key={agent.id} className="bg-surface-card border border-border-default rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-border-subtle flex items-center gap-2">
                <div
                  className="w-5 h-5 rounded-md flex items-center justify-center"
                  style={{ backgroundColor: `${agent.color}20` }}
                >
                  <agent.Icon size={12} color={agent.color} />
                </div>
                <span className="text-sm font-medium text-text-primary">{agent.name}</span>
                <span className="ml-auto text-xs text-text-tertiary">
                  {isLoading ? '检测中…' : `${active.length} / ${files.length} 个文件生效`}
                </span>
              </div>

              {isLoading ? (
                <TableSkeleton rows={3} />
              ) : (
                <>
                  {active.length > 0 && (
                    <div className="px-4 py-2">
                      <div className="text-2xs font-medium text-text-tertiary mb-1.5 mt-1">已生效</div>
                      <div className="space-y-1">
                        {active.map((f) => <ActiveFileRow key={f.key} file={f} exists />)}
                      </div>
                    </div>
                  )}
                  {inactive.length > 0 && (
                    <div className="px-4 py-2 border-t border-border-subtle/50">
                      <div className="text-2xs font-medium text-text-tertiary mb-1.5 mt-1">未创建（可选）</div>
                      <div className="space-y-1">
                        {inactive.map((f) => <ActiveFileRow key={f.key} file={f} exists={false} />)}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function ActiveFileRow({ file, exists }: { file: ApiConfigFile; exists: boolean }) {
  return (
    <div className="flex items-center gap-2.5 py-1">
      {exists
        ? <CheckCircle size={13} className="text-status-active flex-shrink-0" />
        : <Circle size={13} className="text-border-default flex-shrink-0" />
      }
      <span className={`text-xs font-medium w-40 flex-shrink-0 ${exists ? 'text-text-primary' : 'text-text-tertiary'}`}>
        {file.label}
      </span>
      <span className="text-2xs text-text-tertiary font-mono truncate">{file.path}</span>
      {file.modified_at && (
        <span className="text-2xs text-text-tertiary flex-shrink-0 ml-auto">
          {file.modified_at.replace('T', ' ')}
        </span>
      )}
    </div>
  )
}
