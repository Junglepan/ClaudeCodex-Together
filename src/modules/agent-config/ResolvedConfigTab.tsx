import { useState, useEffect } from 'react'
import { ChevronDown, ChevronRight, CheckCircle2, AlertCircle, ArrowRight } from 'lucide-react'
import { api } from '@/core/api'
import type { ApiResolvedConfig, ResolvedSettingsRow, ResolvedInstruction, ResolvedScopeItem } from '@/core/api'
import { useAppStore } from '@/store'

interface Props {
  agentId: string
}

export function ResolvedConfigTab({ agentId }: Props) {
  const { projectPath } = useAppStore()
  const [config, setConfig] = useState<ApiResolvedConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    api.config
      .resolved(agentId, projectPath ?? undefined)
      .then(setConfig)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false))
  }, [agentId, projectPath])

  if (loading) return <LoadingSkeleton />
  if (error)
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-2">
          <AlertCircle size={32} className="mx-auto text-status-warning" />
          <p className="text-sm font-medium text-text-primary">无法加载配置生效树</p>
          <p className="text-xs text-text-tertiary max-w-xs">{error}</p>
        </div>
      </div>
    )
  if (!config) return null

  return (
    <div className="h-full overflow-auto p-6 space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-text-primary">配置生效树</h2>
          <p className="text-2xs text-text-tertiary mt-0.5">
            当前实际生效的配置合并结果，按优先级从低到高展示覆盖关系
          </p>
        </div>
        {config.project && (
          <code className="text-2xs font-mono text-text-tertiary bg-surface-base px-2 py-1 rounded border border-border-default truncate max-w-xs">
            {config.project}
          </code>
        )}
      </div>

      <SettingsSection rows={config.settings} />
      <InstructionsSection instructions={config.instructions} />
      <ScopeSection title="Skills 作用域" items={config.skills} emptyHint="未找到任何 skill 文件" />
      <ScopeSection title="Agents 作用域" items={config.agents} emptyHint="未找到任何 agent 文件" />
    </div>
  )
}

// ── Settings merge table ───────────────────────────────────────────────────────

function SettingsSection({ rows }: { rows: ResolvedSettingsRow[] }) {
  const [open, setOpen] = useState(true)

  return (
    <Section
      title="设置合并结果"
      badge={rows.length}
      open={open}
      onToggle={() => setOpen((p) => !p)}
      hint="多层 settings.json 合并后最终生效的值"
    >
      {rows.length === 0 ? (
        <EmptyHint>未找到任何设置项</EmptyHint>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border-subtle">
                <th className="text-left px-4 py-2 text-2xs font-semibold text-text-tertiary uppercase tracking-wider w-2/5">键</th>
                <th className="text-left px-4 py-2 text-2xs font-semibold text-text-tertiary uppercase tracking-wider w-2/5">生效值</th>
                <th className="text-left px-4 py-2 text-2xs font-semibold text-text-tertiary uppercase tracking-wider">来源</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {rows.map((row) => (
                <tr key={row.key} className="hover:bg-surface-hover transition-colors">
                  <td className="px-4 py-2.5">
                    <code className="font-mono text-text-primary">{row.key}</code>
                  </td>
                  <td className="px-4 py-2.5">
                    <code className="font-mono text-text-secondary break-all">{row.value}</code>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {row.overrides.map((src) => (
                        <span key={src} className="flex items-center gap-1">
                          <SourceBadge source={src as 'global' | 'project' | 'local_override'} dim />
                          <ArrowRight size={10} className="text-text-tertiary" />
                        </span>
                      ))}
                      <SourceBadge source={row.source as 'global' | 'project' | 'local_override'} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  )
}

// ── Instruction load order ─────────────────────────────────────────────────────

function InstructionsSection({ instructions }: { instructions: ResolvedInstruction[] }) {
  const [open, setOpen] = useState(true)

  return (
    <Section
      title="指令加载顺序"
      badge={instructions.filter((i) => i.exists).length}
      open={open}
      onToggle={() => setOpen((p) => !p)}
      hint="Markdown 指令文件按优先级依次注入，后者可覆盖前者"
    >
      <div className="divide-y divide-border-subtle">
        {instructions.map((inst) => (
          <div key={inst.path} className="flex items-center gap-3 px-4 py-2.5">
            <div className="w-5 h-5 rounded-full bg-surface-base border border-border-default flex items-center justify-center flex-shrink-0">
              <span className="text-2xs font-bold text-text-tertiary">{inst.order}</span>
            </div>
            <div className="flex-1 min-w-0">
              <code className="text-xs font-mono text-text-primary truncate block">{inst.path}</code>
              <span className="text-2xs text-text-tertiary capitalize">{inst.scope === 'global' ? '全局' : '项目'}</span>
            </div>
            {inst.exists ? (
              <CheckCircle2 size={14} className="text-status-active flex-shrink-0" />
            ) : (
              <span className="text-2xs text-text-tertiary flex-shrink-0">未创建</span>
            )}
          </div>
        ))}
      </div>
    </Section>
  )
}

// ── Scope section (skills / agents) ───────────────────────────────────────────

function ScopeSection({
  title,
  items,
  emptyHint,
}: {
  title: string
  items: ResolvedScopeItem[]
  emptyHint: string
}) {
  const [open, setOpen] = useState(true)

  return (
    <Section
      title={title}
      badge={items.length}
      open={open}
      onToggle={() => setOpen((p) => !p)}
      hint="全局与项目级条目合并后的最终作用域"
    >
      {items.length === 0 ? (
        <EmptyHint>{emptyHint}</EmptyHint>
      ) : (
        <div className="divide-y divide-border-subtle">
          {items.map((item) => (
            <div key={item.name} className="flex items-center gap-3 px-4 py-2.5">
              <span className="text-xs font-medium text-text-primary flex-1 truncate">{item.name}</span>
              <SourceBadge source={item.source as 'global' | 'project' | 'local_override'} />
              {item.overridden_by === 'project' && (
                <span className="text-2xs text-accent-orange bg-accent-orange/10 px-1.5 py-0.5 rounded font-medium">
                  项目覆盖
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </Section>
  )
}

// ── Shared UI primitives ───────────────────────────────────────────────────────

function Section({
  title,
  badge,
  hint,
  open,
  onToggle,
  children,
}: {
  title: string
  badge?: number
  hint?: string
  open: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  return (
    <div className="bg-surface-card border border-border-default rounded-xl overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2 px-4 py-3 border-b border-border-subtle hover:bg-surface-hover transition-colors text-left"
      >
        {open ? <ChevronDown size={13} className="text-text-tertiary flex-shrink-0" /> : <ChevronRight size={13} className="text-text-tertiary flex-shrink-0" />}
        <span className="text-sm font-medium text-text-primary">{title}</span>
        {badge !== undefined && (
          <span className="text-2xs font-semibold text-text-tertiary bg-surface-base border border-border-default rounded-full px-2 py-0.5">
            {badge}
          </span>
        )}
        {hint && <span className="ml-2 text-2xs text-text-tertiary hidden sm:inline">{hint}</span>}
      </button>
      {open && <div className="animate-fade-in">{children}</div>}
    </div>
  )
}

function SourceBadge({
  source,
  dim = false,
}: {
  source: 'global' | 'project' | 'local_override'
  dim?: boolean
}) {
  const map = {
    global: { label: '全局', cls: 'bg-accent-blue/10 text-accent-blue' },
    project: { label: '项目', cls: 'bg-accent-green/10 text-accent-green' },
    local_override: { label: '本地覆盖', cls: 'bg-accent-orange/10 text-accent-orange' },
  }
  const { label, cls } = map[source] ?? { label: source, cls: 'bg-surface-base text-text-tertiary' }
  return (
    <span className={`text-2xs font-medium px-1.5 py-0.5 rounded ${cls} ${dim ? 'opacity-50' : ''}`}>
      {label}
    </span>
  )
}

function EmptyHint({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-4 py-6 text-center text-2xs text-text-tertiary">{children}</div>
  )
}

function LoadingSkeleton() {
  return (
    <div className="p-6 space-y-4 animate-pulse">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="bg-surface-card border border-border-default rounded-xl overflow-hidden">
          <div className="h-10 bg-surface-hover" />
          <div className="p-4 space-y-2">
            {[1, 2, 3].map((j) => (
              <div key={j} className="h-8 bg-surface-base rounded" />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
