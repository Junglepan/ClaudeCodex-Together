import { useState, useEffect } from 'react'
import { ChevronDown, ChevronRight, Pencil, Trash2, Check, X, AlertTriangle, Bot, Copy, Maximize2, Minimize2 } from 'lucide-react'
import { api } from '@/core/api'
import type { ApiSubagentItem } from '@/core/api'
import { useAppStore } from '@/store'

interface Props {
  agentId: string
}

export function SubagentsTab({ agentId }: Props) {
  const { projectPath, pushToast } = useAppStore()
  const [items, setItems] = useState<ApiSubagentItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = () => {
    setLoading(true)
    setError(null)
    api.subagents
      .list(agentId, projectPath ?? undefined)
      .then(setItems)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [agentId, projectPath])

  if (loading) return <LoadingSkeleton />
  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-2">
          <AlertTriangle size={32} className="mx-auto text-status-warning" />
          <p className="text-sm font-medium text-text-primary">无法加载 Agents</p>
          <p className="text-xs text-text-tertiary max-w-xs">{error}</p>
          <button onClick={load} className="text-xs text-accent-blue hover:underline mt-2">重试</button>
        </div>
      </div>
    )
  }

  const globalItems = items.filter((s) => s.source === 'global')
  const projectItems = items.filter((s) => s.source === 'project')

  return (
    <div className="h-full overflow-auto p-6 space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-text-primary">Agents 管理</h2>
          <p className="text-2xs text-text-tertiary mt-0.5">
            {agentId === 'claude'
              ? '自定义子 Agent 定义，存放于 .claude/agents/*.md'
              : '自定义子 Agent 定义，存放于 .codex/agents/*.toml'}
          </p>
        </div>
        <span className="text-2xs font-semibold text-text-tertiary bg-surface-base border border-border-default rounded-full px-2.5 py-0.5">
          {items.length} 个
        </span>
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Bot size={32} className="text-text-tertiary mb-3" />
          <p className="text-sm font-medium text-text-primary">暂无子 Agent</p>
          <p className="text-xs text-text-tertiary mt-1 max-w-xs">
            {agentId === 'claude'
              ? '在 ~/.claude/agents/ 或 .claude/agents/ 目录下创建 .md 文件来定义子 Agent'
              : '在 ~/.codex/agents/ 或 .codex/agents/ 目录下创建 .toml 文件来定义子 Agent'}
          </p>
        </div>
      ) : (
        <>
          {globalItems.length > 0 && (
            <AgentGroup label="全局 Agents" items={globalItems} onRefresh={load} />
          )}
          {projectItems.length > 0 && (
            <AgentGroup label="项目 Agents" items={projectItems} onRefresh={load} />
          )}
        </>
      )}
    </div>
  )
}

function AgentGroup({ label, items, onRefresh }: { label: string; items: ApiSubagentItem[]; onRefresh: () => void }) {
  return (
    <div className="bg-surface-card border border-border-default rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-border-subtle flex items-center gap-2">
        <Bot size={13} className="text-accent-blue" />
        <span className="text-sm font-medium text-text-primary">{label}</span>
        <span className="text-2xs text-text-tertiary">{items.length} 个</span>
      </div>
      <div className="divide-y divide-border-subtle">
        {items.map((item) => (
          <AgentCard key={item.path} item={item} onRefresh={onRefresh} />
        ))}
      </div>
    </div>
  )
}

function AgentCard({ item, onRefresh }: { item: ApiSubagentItem; onRefresh: () => void }) {
  const { pushToast } = useAppStore()
  const [expanded, setExpanded] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editContent, setEditContent] = useState('')
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [contentExpanded, setContentExpanded] = useState(false)

  const MAX_PREVIEW = 2000
  const truncated = !contentExpanded && item.content.length > MAX_PREVIEW

  const handleEdit = () => {
    setEditContent(item.content)
    setEditing(true)
    setExpanded(true)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await api.files.write(item.path, editContent)
      pushToast({ kind: 'success', message: `已保存：${item.name}` })
      setEditing(false)
      onRefresh()
    } catch (e) {
      pushToast({ kind: 'error', message: `保存失败：${e instanceof Error ? e.message : String(e)}` })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await api.files.delete(item.path)
      pushToast({ kind: 'success', message: `已删除：${item.name}` })
      setConfirmDelete(false)
      onRefresh()
    } catch (e) {
      pushToast({ kind: 'error', message: `删除失败：${e instanceof Error ? e.message : String(e)}` })
    } finally {
      setDeleting(false)
    }
  }

  const handleCopy = () => {
    navigator.clipboard?.writeText(item.content)
    pushToast({ kind: 'success', message: '已复制内容' })
  }

  return (
    <div className="group">
      <div
        className="flex items-center gap-3 px-4 py-3 hover:bg-surface-hover transition-colors cursor-pointer"
        onClick={() => !editing && setExpanded((p) => !p)}
      >
        {expanded
          ? <ChevronDown size={13} className="text-text-tertiary flex-shrink-0" />
          : <ChevronRight size={13} className="text-text-tertiary flex-shrink-0" />}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-text-primary">{item.name}</span>
            <span className={`text-2xs font-medium px-1.5 py-0.5 rounded ${
              item.source === 'global' ? 'bg-accent-blue/10 text-accent-blue' : 'bg-accent-green/10 text-accent-green'
            }`}>
              {item.source === 'global' ? '全局' : '项目'}
            </span>
            <span className="text-2xs font-mono text-text-tertiary bg-surface-base px-1.5 py-0.5 rounded">
              .{item.format}
            </span>
            {item.tools && item.tools.length > 0 && (
              <span className="text-2xs text-accent-orange bg-accent-orange/10 px-1.5 py-0.5 rounded">
                {item.tools.length} tools
              </span>
            )}
          </div>
          {item.description && (
            <p className="text-2xs text-text-tertiary mt-0.5 truncate">{item.description}</p>
          )}
        </div>
        <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={handleEdit}
            className="flex items-center gap-1 text-2xs px-2 py-1 rounded-lg border border-border-default hover:bg-surface-hover text-text-secondary transition-colors"
          >
            <Pencil size={10} />
            编辑
          </button>
          <button
            onClick={() => setConfirmDelete(true)}
            className="flex items-center gap-1 text-2xs px-2 py-1 rounded-lg border border-red-200 hover:bg-red-50 text-red-500 transition-colors"
          >
            <Trash2 size={10} />
            删除
          </button>
        </div>
      </div>

      {confirmDelete && (
        <div className="mx-4 mb-3 p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3 animate-fade-in">
          <AlertTriangle size={14} className="text-red-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-xs font-medium text-red-800">确认删除 "{item.name}"？</p>
            <p className="text-2xs text-red-600 mt-0.5 font-mono break-all">{item.path}</p>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="text-2xs px-2.5 py-1 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50"
            >
              {deleting ? '删除中…' : '确认'}
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              className="text-2xs px-2.5 py-1 border border-red-300 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
            >
              取消
            </button>
          </div>
        </div>
      )}

      {expanded && (
        <div className="px-4 pb-4 animate-fade-in">
          <div className="text-2xs text-text-tertiary font-mono mb-2 truncate">{item.path}</div>

          {item.tools && item.tools.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap mb-2">
              <span className="text-2xs text-text-tertiary">Tools:</span>
              {item.tools.map((t) => (
                <span key={t} className="text-2xs font-mono bg-surface-base border border-border-default px-1.5 py-0.5 rounded text-text-secondary">{t}</span>
              ))}
            </div>
          )}

          {editing ? (
            <div className="space-y-2">
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') { e.preventDefault(); handleSave() }
                  if (e.key === 'Escape') { e.preventDefault(); setEditing(false) }
                }}
                className="w-full h-64 p-3 text-xs font-mono text-text-primary bg-surface-base border border-border-default rounded-lg outline-none focus:border-accent-blue transition-colors resize-y leading-relaxed"
                spellCheck={false}
              />
              <div className="flex items-center gap-2 justify-end">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-1 text-2xs px-3 py-1.5 bg-accent-blue text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50"
                >
                  <Check size={11} />
                  {saving ? '保存中…' : '保存 (⌘S)'}
                </button>
                <button
                  onClick={() => setEditing(false)}
                  className="flex items-center gap-1 text-2xs px-3 py-1.5 border border-border-default text-text-secondary rounded-lg hover:bg-surface-hover transition-colors"
                >
                  <X size={11} />
                  取消
                </button>
              </div>
            </div>
          ) : (
            <div className="border border-border-default rounded-lg overflow-hidden">
              <div className="px-3 py-1.5 bg-surface-base border-b border-border-subtle flex items-center justify-between">
                <span className="text-2xs text-text-tertiary">{item.content.split('\n').length} 行</span>
                <div className="flex items-center gap-2">
                  {item.content.length > MAX_PREVIEW && (
                    <button
                      onClick={() => setContentExpanded(!contentExpanded)}
                      className="flex items-center gap-1 text-2xs text-accent-blue hover:text-blue-600 transition-colors"
                    >
                      {contentExpanded ? <Minimize2 size={11} /> : <Maximize2 size={11} />}
                      {contentExpanded ? '收起' : '查看完整内容'}
                    </button>
                  )}
                  <button onClick={handleCopy} className="text-text-tertiary hover:text-text-secondary transition-colors" title="复制">
                    <Copy size={12} />
                  </button>
                </div>
              </div>
              <pre className={`p-3 text-xs font-mono text-text-primary overflow-auto leading-relaxed bg-surface-card ${contentExpanded ? 'max-h-[70vh]' : 'max-h-48'}`}>
                {truncated ? item.content.slice(0, MAX_PREVIEW) : item.content}
                {truncated && <span className="text-text-tertiary">{'\n'}…（内容已截断）</span>}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function LoadingSkeleton() {
  return (
    <div className="p-6 space-y-4 animate-pulse">
      <div className="h-6 w-1/4 bg-border-subtle/70 rounded" />
      <div className="h-4 w-1/2 bg-border-subtle/70 rounded" />
      {[1, 2, 3].map((i) => (
        <div key={i} className="bg-surface-card border border-border-default rounded-xl p-4 space-y-2">
          <div className="h-5 w-1/3 bg-border-subtle/70 rounded" />
          <div className="h-4 w-2/3 bg-border-subtle/70 rounded" />
        </div>
      ))}
    </div>
  )
}
