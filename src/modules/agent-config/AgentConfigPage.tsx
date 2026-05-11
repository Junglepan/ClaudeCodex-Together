import { useState, useCallback } from 'react'
import { ChevronDown, ChevronRight, File, Folder, RefreshCw, Search, LayoutGrid, List, GitMerge } from 'lucide-react'
import { agentRegistry } from '@/core/agent-registry'
import { useAppStore } from '@/store'
import { useAgents, useAgentFiles } from '@/hooks/useAgents'
import type { ApiConfigFile, ApiAgentSummary } from '@/core/api'
import { FileDetail } from '../config-files/FileDetail'
import { ClaudeRelTree } from './ClaudeRelTree'
import { ResolvedConfigTab } from './ResolvedConfigTab'
import { StatusBadge, ScopeBadge, FormatBadge } from '@/components/ui/Badges'
import { EmptyState } from '@/components/ui/Skeleton'
import { electronApi, isElectron } from '@/lib/electron-bridge'

interface SelectedFile {
  agentId: string
  fileKey: string
  path: string
}

interface Props {
  agentId: string
}

type Tab = 'overview' | 'files' | 'resolved'

export function AgentConfigPage({ agentId }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('overview')
  const { summaries } = useAgents({ withFiles: false })
  const { files, refresh } = useAgentFiles(agentId)
  const { refreshing } = useAppStore()
  const agent = agentRegistry.get(agentId)

  if (!agent) return <div className="p-6 text-text-tertiary text-sm">未知 Agent</div>

  const summary = summaries.find((s) => s.id === agentId)
  const activeFiles = files.filter((f) => f.exists)

  return (
    <div className="flex-1 min-w-0 flex flex-col h-full overflow-hidden animate-fade-in">
      <div className="px-6 py-4 border-b border-border-default flex items-center gap-4 flex-shrink-0 bg-white">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: `${agent.color}18` }}
        >
          <agent.Icon size={20} color={agent.color} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2.5">
            <h1 className="text-base font-semibold text-text-primary">{agent.name}</h1>
            {summary && <StatusBadge status={summary.status} />}
          </div>
          <div className="flex items-center gap-3 mt-0.5 text-2xs text-text-tertiary">
            <code className="font-mono truncate">{agent.globalDir}</code>
            <span>·</span>
            <span className="text-status-active font-medium">{activeFiles.length}</span>
            <span>个文件已存在</span>
            <span>·</span>
            <span>{files.length - activeFiles.length} 个未创建</span>
          </div>
        </div>
        <button
          onClick={() => refresh()}
          disabled={refreshing}
          className="text-text-tertiary hover:text-text-secondary transition-colors p-1.5 rounded-lg hover:bg-surface-hover disabled:opacity-50"
          title="刷新 (⌘R)"
        >
          <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="px-6 border-b border-border-default flex gap-0 flex-shrink-0 bg-white">
        <TabBtn active={activeTab === 'overview'} onClick={() => setActiveTab('overview')}
          icon={<LayoutGrid size={13} />} label="总览" />
        <TabBtn active={activeTab === 'files'} onClick={() => setActiveTab('files')}
          icon={<List size={13} />} label="配置明细" />
        <TabBtn active={activeTab === 'resolved'} onClick={() => setActiveTab('resolved')}
          icon={<GitMerge size={13} />} label="配置生效树" />
      </div>

      <div className="flex-1 overflow-hidden">
        {activeTab === 'overview' ? (
          <OverviewTab agentId={agentId} files={files} summary={summary} />
        ) : activeTab === 'resolved' ? (
          <ResolvedConfigTab agentId={agentId} />
        ) : (
          <FilesTab agentId={agentId} />
        )}
      </div>
    </div>
  )
}

function TabBtn({
  active, onClick, icon, label,
}: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-4 py-3 text-sm border-b-2 transition-colors ${
        active
          ? 'border-accent-blue text-accent-blue font-medium'
          : 'border-transparent text-text-secondary hover:text-text-primary'
      }`}
    >
      {icon}
      {label}
    </button>
  )
}

function OverviewTab({
  agentId,
  files,
  summary: _summary,
}: {
  agentId: string
  files: ApiConfigFile[]
  summary?: ApiAgentSummary
}) {
  const existingFiles = files.filter((f) => f.exists)
  const missingFiles = files.filter((f) => !f.exists)
  const globalFiles = files.filter((f) => f.scope === 'global')
  const projectFiles = files.filter((f) => f.scope === 'project')

  return (
    <div className="h-full overflow-auto p-6 space-y-5 animate-fade-in">
      <div className="grid grid-cols-4 gap-3">
        <StatCard label="已存在" value={existingFiles.length} color="text-status-active" />
        <StatCard label="未创建" value={missingFiles.length} color="text-text-tertiary" />
        <StatCard label="全局范围" value={globalFiles.length} color="text-text-secondary" />
        <StatCard label="项目范围" value={projectFiles.length} color="text-text-secondary" />
      </div>

      <div className="bg-white border border-border-default rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border-subtle flex items-center justify-between">
          <h2 className="text-sm font-medium text-text-primary">文件状态</h2>
          <div className="flex items-center gap-3 text-2xs text-text-tertiary">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-status-active inline-block" /> 已存在</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-border-default inline-block" /> 未创建</span>
          </div>
        </div>
        <div className="divide-y divide-border-subtle">
          {files.map((f) => (
            <div key={f.key} className="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-hover transition-colors">
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${f.exists ? 'bg-status-active' : 'bg-border-default'}`} />
              <div className="flex-1 min-w-0">
                <span className="text-xs font-medium text-text-primary">{f.label}</span>
                <code className="ml-2 text-2xs text-text-tertiary font-mono">{f.path}</code>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <ScopeBadge scope={f.scope} />
                <FormatBadge format={f.format} />
                {f.status === 'active' && <span className="text-2xs text-status-active">活跃</span>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {agentId === 'claude' && (
        <div className="bg-white border border-border-default rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border-subtle">
            <h2 className="text-sm font-medium text-text-primary">配置关系与优先级</h2>
            <p className="text-2xs text-text-tertiary mt-0.5">Claude Code 配置文件的加载顺序、合并策略与作用域</p>
          </div>
          <div className="p-4">
            <ClaudeRelTree />
          </div>
        </div>
      )}

      {agentId === 'codex' && (
        <div className="bg-white border border-border-default rounded-xl p-4">
          <h2 className="text-sm font-medium text-text-primary mb-3">配置层次说明</h2>
          <div className="space-y-2.5">
            <HierarchyItem step={1} label="全局配置" path="~/.codex/config.toml" desc="全局行为设置，适用于所有项目" />
            <HierarchyItem step={2} label="全局指令" path="~/.codex/AGENTS.md" desc="全局 Agent 行为指令，每个会话注入" />
            <HierarchyItem step={3} label="项目指令" path="./AGENTS.md" desc="项目级指令，优先级高于全局（覆盖）" />
            <HierarchyItem step={4} label="全局 Skills" path="~/.agents/skills/" desc="全局可用技能，通过 /skill 调用" />
            <HierarchyItem step={5} label="项目 Agents" path=".codex/agents/" desc="项目专属 Agent 定义" />
          </div>
        </div>
      )}
    </div>
  )
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-white border border-border-default rounded-xl px-4 py-3 text-center">
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
      <div className="text-2xs text-text-tertiary mt-0.5">{label}</div>
    </div>
  )
}

function HierarchyItem({ step, label, path, desc }: { step: number; label: string; path: string; desc: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-5 h-5 rounded-full bg-surface-base border border-border-default flex items-center justify-center flex-shrink-0 mt-0.5">
        <span className="text-2xs font-bold text-text-tertiary">{step}</span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-medium text-text-primary">{label}</span>
          <code className="text-2xs font-mono text-text-tertiary bg-surface-base px-1.5 py-0.5 rounded">{path}</code>
        </div>
        <p className="text-2xs text-text-tertiary mt-0.5">{desc}</p>
      </div>
    </div>
  )
}

function FilesTab({ agentId }: { agentId: string }) {
  const { selectedFile, setSelectedFile } = useAppStore()
  const { files, refresh } = useAgentFiles(agentId)
  const { refreshing } = useAppStore()
  const [search, setSearch] = useState('')

  const filtered = search
    ? files.filter(
        (f) =>
          f.label.toLowerCase().includes(search.toLowerCase()) ||
          f.path.toLowerCase().includes(search.toLowerCase())
      )
    : files

  const globalFiles = filtered.filter((f) => f.scope === 'global')
  const projectFiles = filtered.filter((f) => f.scope === 'project')

  return (
    <div className="flex flex-1 h-full overflow-hidden">
      <div className="w-72 border-r border-border-default flex flex-col bg-surface-base flex-shrink-0">
        <div className="px-3 py-2.5 border-b border-border-default">
          <div className="relative">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-tertiary" />
            <input
              type="text"
              placeholder="搜索文件"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-border-default rounded-lg outline-none focus:border-accent-blue transition-colors"
            />
          </div>
        </div>

        <div className="flex-1 overflow-auto py-2">
          <FileGroup
            label="全局配置"
            files={globalFiles}
            agentId={agentId}
            selectedFile={selectedFile}
            onSelect={setSelectedFile}
          />
          <FileGroup
            label="项目配置"
            files={projectFiles}
            agentId={agentId}
            selectedFile={selectedFile}
            onSelect={setSelectedFile}
          />
        </div>

        <div className="px-3 py-2 border-t border-border-default flex items-center justify-between">
          <span className="text-2xs text-text-tertiary">
            {files.filter((f) => f.exists).length}/{files.length} 个活跃
          </span>
          <button
            onClick={() => refresh()}
            disabled={refreshing}
            className="text-text-tertiary hover:text-text-secondary disabled:opacity-50"
            title="刷新 (⌘R)"
          >
            <RefreshCw size={11} className={refreshing ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto bg-white">
        {selectedFile && selectedFile.agentId === agentId ? (
          <FileDetail agentId={selectedFile.agentId} fileKey={selectedFile.fileKey} />
        ) : (
          <EmptyState title="选择左侧文件查看详情" hint="按 / 聚焦搜索" />
        )}
      </div>
    </div>
  )
}

function FileGroup({
  label,
  files,
  agentId,
  selectedFile,
  onSelect,
}: {
  label: string
  files: ApiConfigFile[]
  agentId: string
  selectedFile: SelectedFile | null
  onSelect: (f: SelectedFile | null) => void
}) {
  const [open, setOpen] = useState(true)
  const { pushToast } = useAppStore()

  const handleContextMenu = useCallback(async (e: React.MouseEvent, file: ApiConfigFile) => {
    e.preventDefault()
    if (!isElectron) return

    const menuItems = [
      { label: '查看详情', action: 'select', enabled: true },
      { label: '---', action: '' },
      { label: '在 Finder 中显示', action: 'reveal', enabled: file.exists },
      { label: '在终端中打开', action: 'terminal', enabled: file.exists && file.kind === 'dir' },
      { label: '---', action: '' },
      { label: '复制路径', action: 'copy' },
    ]

    const action = await electronApi.showContextMenu(menuItems)
    if (!action) return

    if (action === 'select') {
      onSelect({ agentId, fileKey: file.key, path: file.path })
    } else if (action === 'reveal') {
      electronApi.revealInFinder(file.path).catch((err) =>
        pushToast({ kind: 'error', message: String(err) }),
      )
    } else if (action === 'terminal') {
      electronApi.openInTerminal(file.path).catch((err) =>
        pushToast({ kind: 'error', message: String(err) }),
      )
    } else if (action === 'copy') {
      navigator.clipboard.writeText(file.path).catch(() => {
        pushToast({ kind: 'error', message: '无法写入剪贴板' })
      })
      pushToast({ kind: 'success', message: '已复制路径' })
    }
  }, [agentId, onSelect, pushToast])

  if (files.length === 0) return null

  return (
    <div className="mb-1">
      <button
        onClick={() => setOpen((p) => !p)}
        className="w-full flex items-center gap-1.5 px-3 py-1.5 text-2xs font-semibold text-text-tertiary uppercase tracking-wider hover:bg-surface-hover transition-colors"
      >
        {open ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
        {label}
        <span className="ml-auto font-normal normal-case tracking-normal">{files.filter((f) => f.exists).length}/{files.length}</span>
      </button>
      {open && (
        <div className="animate-fade-in">
          {files.map((file) => {
            const isSelected = selectedFile?.agentId === agentId && selectedFile?.fileKey === file.key
            const Icon = file.kind === 'dir' ? Folder : File
            return (
              <button
                key={file.key}
                onClick={() => onSelect({ agentId, fileKey: file.key, path: file.path })}
                onContextMenu={(e) => handleContextMenu(e, file)}
                className={`w-full flex items-center gap-2 px-4 py-2 rounded-lg mx-2 text-left transition-colors ${
                  isSelected
                    ? 'bg-accent-blue/10 text-accent-blue'
                    : 'hover:bg-surface-hover text-text-primary'
                }`}
                style={{ width: 'calc(100% - 16px)' }}
              >
                <Icon size={12} className={isSelected ? 'text-accent-blue' : 'text-text-tertiary'} />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium truncate">{file.label}</div>
                </div>
                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${file.exists ? 'bg-status-active' : 'bg-border-default'}`} />
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
