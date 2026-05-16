import { useState, useEffect } from 'react'
import { AlertTriangle, Plug, ChevronDown, ChevronRight, Copy, Check, Terminal } from 'lucide-react'
import { api } from '@/core/api'
import type { ApiMcpServerItem } from '@/core/api'
import { useAppStore } from '@/store'

interface Props {
  agentId: string
}

export function McpTab({ agentId }: Props) {
  const { projectPath } = useAppStore()
  const [items, setItems] = useState<ApiMcpServerItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = () => {
    setLoading(true)
    setError(null)
    api.mcp
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
          <p className="text-sm font-medium text-text-primary">无法加载 MCP 配置</p>
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
          <h2 className="text-sm font-semibold text-text-primary">MCP Servers</h2>
          <p className="text-2xs text-text-tertiary mt-0.5">
            {agentId === 'claude'
              ? 'Model Context Protocol 服务器配置，来源于 settings.json 和 .mcp.json'
              : 'Model Context Protocol 服务器配置，来源于 config.toml'}
          </p>
        </div>
        <span className="text-2xs font-semibold text-text-tertiary bg-surface-base border border-border-default rounded-full px-2.5 py-0.5">
          {items.length} 个
        </span>
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Plug size={32} className="text-text-tertiary mb-3" />
          <p className="text-sm font-medium text-text-primary">暂无 MCP Server</p>
          <p className="text-xs text-text-tertiary mt-1 max-w-xs">
            {agentId === 'claude'
              ? '在 settings.json 的 mcpServers 字段或项目 .mcp.json 中配置 MCP 服务器'
              : '在 config.toml 的 [mcp_servers] 部分配置 MCP 服务器'}
          </p>
        </div>
      ) : (
        <>
          {globalItems.length > 0 && (
            <ServerGroup label="全局 MCP Servers" items={globalItems} />
          )}
          {projectItems.length > 0 && (
            <ServerGroup label="项目 MCP Servers" items={projectItems} />
          )}
        </>
      )}
    </div>
  )
}

function ServerGroup({ label, items }: { label: string; items: ApiMcpServerItem[] }) {
  return (
    <div className="bg-surface-card border border-border-default rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-border-subtle flex items-center gap-2">
        <Plug size={13} className="text-accent-blue" />
        <span className="text-sm font-medium text-text-primary">{label}</span>
        <span className="text-2xs text-text-tertiary">{items.length} 个</span>
      </div>
      <div className="divide-y divide-border-subtle">
        {items.map((item) => (
          <ServerCard key={`${item.name}-${item.origin}`} item={item} />
        ))}
      </div>
    </div>
  )
}

function ServerCard({ item }: { item: ApiMcpServerItem }) {
  const [expanded, setExpanded] = useState(false)
  const envKeys = Object.keys(item.env)
  const fullCommand = [item.command, ...item.args].join(' ')

  return (
    <div>
      <div
        className="flex items-center gap-3 px-4 py-3 hover:bg-surface-hover transition-colors cursor-pointer"
        onClick={() => setExpanded((p) => !p)}
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
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <Terminal size={10} className="text-text-tertiary flex-shrink-0" />
            <code className="text-2xs font-mono text-text-tertiary truncate">{fullCommand}</code>
          </div>
        </div>
        {envKeys.length > 0 && (
          <span className="text-2xs text-text-tertiary bg-surface-base px-1.5 py-0.5 rounded border border-border-default flex-shrink-0">
            {envKeys.length} env
          </span>
        )}
      </div>

      {expanded && (
        <div className="px-4 pb-4 animate-fade-in space-y-3">
          <div className="text-2xs text-text-tertiary">
            来源：<span className="font-mono">{item.origin}</span>
          </div>

          <div className="bg-surface-base border border-border-subtle rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-2xs font-medium text-text-tertiary uppercase tracking-wider">Command</span>
              <CopyBtn text={fullCommand} />
            </div>
            <code className="text-xs font-mono text-text-primary block break-all">{item.command}</code>
            {item.args.length > 0 && (
              <div className="space-y-1">
                <span className="text-2xs font-medium text-text-tertiary uppercase tracking-wider">Args</span>
                {item.args.map((arg, i) => (
                  <code key={i} className="text-xs font-mono text-text-secondary block break-all pl-2">{arg}</code>
                ))}
              </div>
            )}
          </div>

          {envKeys.length > 0 && (
            <div className="bg-surface-base border border-border-subtle rounded-lg p-3">
              <span className="text-2xs font-medium text-text-tertiary uppercase tracking-wider block mb-2">Environment</span>
              <div className="space-y-1">
                {envKeys.map((key) => (
                  <div key={key} className="flex items-center gap-2 text-xs font-mono">
                    <span className="text-accent-blue">{key}</span>
                    <span className="text-text-tertiary">=</span>
                    <span className="text-text-secondary truncate">
                      {item.env[key].length > 40
                        ? `${item.env[key].slice(0, 20)}…${item.env[key].slice(-10)}`
                        : item.env[key]}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const handle = () => {
    navigator.clipboard?.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  return (
    <button onClick={handle} className="text-text-tertiary hover:text-text-secondary transition-colors flex-shrink-0" title="复制">
      {copied ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
    </button>
  )
}

function LoadingSkeleton() {
  return (
    <div className="p-6 space-y-4 animate-pulse">
      <div className="h-6 w-1/4 bg-border-subtle/70 rounded" />
      <div className="h-4 w-1/2 bg-border-subtle/70 rounded" />
      {[1, 2].map((i) => (
        <div key={i} className="bg-surface-card border border-border-default rounded-xl p-4 space-y-2">
          <div className="h-5 w-1/3 bg-border-subtle/70 rounded" />
          <div className="h-4 w-2/3 bg-border-subtle/70 rounded" />
        </div>
      ))}
    </div>
  )
}
