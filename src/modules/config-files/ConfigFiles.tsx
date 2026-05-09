import { useState, useEffect } from 'react'
import { ChevronDown, ChevronRight, File, Folder, RefreshCw, Search } from 'lucide-react'
import { agentRegistry } from '@/core/agent-registry'
import { useAppStore } from '@/store'
import { api } from '@/core/api'
import type { ApiConfigFile } from '@/core/api'
import { FileDetail } from './FileDetail'

export function ConfigFiles() {
  const { agentFiles, setAgentFiles, selectedFile, setSelectedFile, projectPath } = useAppStore()
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ claude: true, codex: true })

  const agents = agentRegistry.getAll()

  useEffect(() => {
    agents.forEach((agent) => {
      api.agents.files(agent.id, projectPath)
        .then((files) => setAgentFiles(agent.id, files))
        .catch(console.error)
    })
  }, [projectPath])

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

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Middle panel: file tree */}
      <div className="w-72 border-r border-border-default flex flex-col bg-surface-base">
        {/* Header */}
        <div className="px-4 py-3 border-b border-border-default">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-text-primary">配置文件与路径</span>
            <button
              onClick={() =>
                agents.forEach((a) =>
                  api.agents.files(a.id, projectPath)
                    .then((f) => setAgentFiles(a.id, f))
                    .catch(console.error)
                )
              }
              className="text-text-tertiary hover:text-text-secondary transition-colors"
            >
              <RefreshCw size={14} />
            </button>
          </div>
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-tertiary" />
            <input
              type="text"
              placeholder="搜索文件或路径"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-border-default rounded-lg outline-none focus:border-accent-blue transition-colors"
            />
          </div>
        </div>

        {/* File tree */}
        <div className="flex-1 overflow-auto py-2">
          {agents.map((agent) => {
            const files = filterFiles(agentFiles[agent.id] ?? [])
            const isOpen = expanded[agent.id] ?? true
            const activeCount = files.filter((f) => f.exists).length

            return (
              <div key={agent.id} className="mb-1">
                {/* Agent group header */}
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
                  <div className="flex-1 text-left">
                    <div className="text-xs font-medium text-text-primary">{agent.shortName}</div>
                    <div className="text-2xs text-text-tertiary">{agent.globalDir}</div>
                  </div>
                  <AgentStatusBadge activeCount={activeCount} total={files.length} />
                </button>

                {/* Files */}
                {isOpen && (
                  <div className="ml-4">
                    {files.map((file) => (
                      <FileTreeItem
                        key={file.key}
                        file={file}
                        agentId={agent.id}
                        isSelected={
                          selectedFile?.agentId === agent.id && selectedFile?.fileKey === file.key
                        }
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

        {/* Footer */}
        <div className="px-4 py-2 border-t border-border-default flex items-center justify-between">
          <span className="text-2xs text-text-tertiary">
            共 {Object.values(agentFiles).flat().length} 个项目，
            {Object.values(agentFiles).flat().filter((f) => f.exists).length} 个活跃
          </span>
          <RefreshCw size={12} className="text-text-tertiary cursor-pointer hover:text-text-secondary" />
        </div>
      </div>

      {/* Right panel: file detail */}
      <div className="flex-1 overflow-auto">
        {selectedFile ? (
          <FileDetail agentId={selectedFile.agentId} fileKey={selectedFile.fileKey} />
        ) : (
          <EmptyDetail />
        )}
      </div>
    </div>
  )
}

function AgentStatusBadge({ activeCount, total }: { activeCount: number; total: number }) {
  if (activeCount === 0)
    return <span className="text-2xs px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500">未安装</span>
  if (activeCount === total)
    return <span className="text-2xs px-1.5 py-0.5 rounded-full bg-green-100 text-green-700">活跃中</span>
  return <span className="text-2xs px-1.5 py-0.5 rounded-full bg-yellow-100 text-yellow-700">部分</span>
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
  const map: Record<string, string> = {
    active: 'text-status-active',
    optional: 'text-text-tertiary',
    available: 'text-text-tertiary',
  }
  const labels: Record<string, string> = {
    active: '活跃',
    optional: '可选',
    available: '可用',
  }
  return (
    <span className={`text-2xs ${map[status] ?? 'text-text-tertiary'}`}>
      {labels[status] ?? status}
    </span>
  )
}

function EmptyDetail() {
  return (
    <div className="flex-1 flex items-center justify-center h-full text-text-tertiary">
      <div className="text-center">
        <File size={32} className="mx-auto mb-3 opacity-30" />
        <p className="text-sm">选择左侧文件查看详情</p>
      </div>
    </div>
  )
}
