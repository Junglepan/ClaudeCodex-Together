import { useState } from 'react'
import { ChevronDown, ChevronRight, File, Folder, RefreshCw, Search } from 'lucide-react'
import { agentRegistry } from '@/core/agent-registry'
import { useAppStore } from '@/store'
import { useAgents } from '@/hooks/useAgents'
import type { ApiConfigFile } from '@/core/api'
import { FileDetail } from './FileDetail'
import { CountBadge } from '@/components/ui/Badges'
import { EmptyState } from '@/components/ui/Skeleton'

export function ConfigFiles() {
  const { selectedFile, setSelectedFile, refreshing } = useAppStore()
  const { filesByAgent, refresh } = useAgents()
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ claude: true, codex: true })

  const agents = agentRegistry.getAll()

  const toggle = (id: string) =>
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }))

  const filterFiles = (files: ApiConfigFile[]) =>
    search
      ? files.filter(
          (f) =>
            f.label.toLowerCase().includes(search.toLowerCase()) ||
            f.path.toLowerCase().includes(search.toLowerCase())
        )
      : files

  const totalFiles = Object.values(filesByAgent).flat()
  const activeTotal = totalFiles.filter((f) => f.exists).length

  return (
    <div className="flex flex-1 overflow-hidden">
      <div className="w-72 border-r border-border-default flex flex-col bg-surface-base flex-shrink-0">
        <div className="px-4 py-3 border-b border-border-default">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-text-primary">配置文件与路径</span>
            <button
              onClick={refresh}
              disabled={refreshing}
              title="刷新 (⌘R)"
              className="text-text-tertiary hover:text-text-secondary transition-colors disabled:opacity-50"
            >
              <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            </button>
          </div>
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-tertiary" />
            <input
              type="text"
              placeholder="搜索文件或路径"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-surface-card border border-border-default rounded-lg outline-none focus:border-accent-blue transition-colors"
            />
          </div>
        </div>

        <div className="flex-1 overflow-auto py-2">
          {agents.map((agent) => {
            const all = filesByAgent[agent.id] ?? []
            const files = filterFiles(all)
            const isOpen = expanded[agent.id] ?? true
            const activeCount = all.filter((f) => f.exists).length

            return (
              <div key={agent.id} className="mb-1">
                <button
                  onClick={() => toggle(agent.id)}
                  className="w-full flex items-center gap-2 px-3 py-2 hover:bg-surface-hover transition-colors"
                >
                  {isOpen ? <ChevronDown size={14} className="text-text-tertiary" /> : <ChevronRight size={14} className="text-text-tertiary" />}
                  <div
                    className="w-5 h-5 rounded-md flex items-center justify-center"
                    style={{ backgroundColor: `${agent.color}20` }}
                  >
                    <agent.Icon size={11} color={agent.color} />
                  </div>
                  <div className="flex-1 text-left min-w-0">
                    <div className="text-xs font-medium text-text-primary truncate">{agent.shortName}</div>
                    <div className="text-2xs text-text-tertiary truncate">{agent.globalDir}</div>
                  </div>
                  <CountBadge active={activeCount} total={all.length} />
                </button>

                {isOpen && (
                  <div className="ml-4 animate-fade-in">
                    {files.map((file) => (
                      <FileTreeItem
                        key={file.key}
                        file={file}
                        agentId={agent.id}
                        isSelected={selectedFile?.agentId === agent.id && selectedFile?.fileKey === file.key}
                        onSelect={() => setSelectedFile({ agentId: agent.id, fileKey: file.key, path: file.path })}
                      />
                    ))}
                    {files.length === 0 && (
                      <p className="px-4 py-2 text-2xs text-text-tertiary">无匹配文件</p>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <div className="px-4 py-2 border-t border-border-default flex items-center justify-between">
          <span className="text-2xs text-text-tertiary">
            共 {totalFiles.length} 个，{activeTotal} 个活跃
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-auto bg-surface-card">
        {selectedFile ? (
          <FileDetail agentId={selectedFile.agentId} fileKey={selectedFile.fileKey} />
        ) : (
          <EmptyState title="选择左侧文件查看详情" hint="按 / 聚焦搜索，⌘R 刷新" />
        )}
      </div>
    </div>
  )
}

function FileTreeItem({
  file,
  agentId,
  isSelected,
  onSelect,
}: {
  file: ApiConfigFile
  agentId: string
  isSelected: boolean
  onSelect: () => void
}) {
  const Icon = file.kind === 'dir' ? Folder : File

  return (
    <button
      onClick={onSelect}
      className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-colors ${
        isSelected
          ? 'bg-accent-blue/10 text-accent-blue'
          : 'hover:bg-surface-hover text-text-primary'
      }`}
    >
      <Icon size={13} className={isSelected ? 'text-accent-blue' : 'text-text-tertiary'} />
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium truncate">{file.label}</div>
        <div className="text-2xs text-text-tertiary truncate">{file.path}</div>
      </div>
      <FileStatusTag status={file.status} exists={file.exists} />
    </button>
  )
}

function FileStatusTag({ status, exists }: { status: string; exists: boolean }) {
  if (!exists) return <span className="text-2xs text-text-tertiary">缺失</span>
  const labels: Record<string, string> = { active: '活跃', optional: '可选', available: '可用' }
  const colors: Record<string, string> = {
    active: 'text-status-active',
    optional: 'text-text-tertiary',
    available: 'text-text-tertiary',
  }
  return (
    <span className={`text-2xs ${colors[status] ?? 'text-text-tertiary'}`}>
      {labels[status] ?? status}
    </span>
  )
}
