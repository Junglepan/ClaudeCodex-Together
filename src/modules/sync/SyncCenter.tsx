import { useState, useEffect, useCallback } from 'react'
import { RefreshCw, ChevronDown, ChevronRight, CheckCircle, AlertCircle, XCircle, ArrowRight, Zap } from 'lucide-react'
import { api } from '@/core/api'
import { useAppStore } from '@/store'
import type { ApiSyncItem, ApiSyncPlan, ApiSyncDryRunResult, ApiSyncResult } from '@/core/api'

type Scope = 'all' | 'global' | 'project'

type Stage =
  | { kind: 'idle' }
  | { kind: 'scanning' }
  | { kind: 'scan_done'; items: ApiSyncItem[] }
  | { kind: 'planning' }
  | { kind: 'plan_done'; plan: ApiSyncPlan }
  | { kind: 'dry_running' }
  | { kind: 'dry_run_done'; dryRun: ApiSyncDryRunResult; plan: ApiSyncPlan }
  | { kind: 'executing' }
  | { kind: 'execute_done'; result: ApiSyncResult; plan: ApiSyncPlan }

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  added:       { label: '待同步',       color: 'text-green-700 bg-green-50' },
  check:       { label: '需人工检查',   color: 'text-yellow-700 bg-yellow-50' },
  unsupported: { label: '不可迁移',     color: 'text-text-tertiary bg-surface-base' },
  not_added:   { label: '已同步',       color: 'text-text-tertiary bg-surface-base' },
}

const DRY_RUN_LABEL: Record<string, { label: string; color: string }> = {
  would_write:      { label: '将写入',   color: 'text-green-700 bg-green-50' },
  would_skip:       { label: '将跳过',   color: 'text-text-tertiary bg-surface-base' },
  skip_unsupported: { label: '不可迁移', color: 'text-text-tertiary bg-surface-base' },
  unknown:          { label: '未知',     color: 'text-text-tertiary bg-surface-base' },
}

const TYPE_BADGE: Record<string, string> = {
  Instruction: 'bg-blue-50 text-blue-700',
  Skill:       'bg-purple-50 text-purple-700',
  Subagent:    'bg-indigo-50 text-indigo-700',
  Command:     'bg-cyan-50 text-cyan-700',
  Hook:        'bg-amber-50 text-amber-700',
  Settings:    'bg-gray-100 text-gray-600',
}

export function SyncCenter() {
  const { projectPath, pushToast } = useAppStore()
  const [scope, setScope]       = useState<Scope>('all')
  const [overwrite, setOverwrite] = useState(false)
  const [stage, setStage]       = useState<Stage>({ kind: 'idle' })
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())

  const toggleRow = (key: string) =>
    setExpandedRows((s) => { const n = new Set(s); n.has(key) ? n.delete(key) : n.add(key); return n })

  // Auto-scan on mount and when scope/projectPath changes
  const runScan = useCallback(async () => {
    setStage({ kind: 'scanning' })
    try {
      const res = await api.sync.scan(scope, projectPath)
      setStage({ kind: 'scan_done', items: res.items })
    } catch (e) {
      pushToast({ kind: 'error', message: `扫描失败：${e instanceof Error ? e.message : String(e)}` })
      setStage({ kind: 'idle' })
    }
  }, [scope, projectPath, pushToast])

  useEffect(() => { runScan() }, [runScan])

  const runPlan = async () => {
    setStage({ kind: 'planning' })
    try {
      const plan = await api.sync.plan(scope, projectPath)
      setStage({ kind: 'plan_done', plan })
    } catch (e) {
      pushToast({ kind: 'error', message: `计划失败：${e instanceof Error ? e.message : String(e)}` })
      setStage(s => s.kind === 'planning' ? { kind: 'idle' } : s)
    }
  }

  const runDryRun = async (plan: ApiSyncPlan) => {
    setStage({ kind: 'dry_running' })
    try {
      const dr = await api.sync.dryRun(scope, projectPath, overwrite)
      setStage({ kind: 'dry_run_done', dryRun: dr, plan })
      pushToast({ kind: 'success', message: `预演完成：${dr.would_write.length} 项将写入` })
    } catch (e) {
      pushToast({ kind: 'error', message: `预演失败：${e instanceof Error ? e.message : String(e)}` })
      setStage({ kind: 'plan_done', plan })
    }
  }

  const runExecute = async (plan: ApiSyncPlan) => {
    setStage({ kind: 'executing' })
    try {
      const result = await api.sync.execute(scope, projectPath, overwrite)
      setStage({ kind: 'execute_done', result, plan })
      pushToast({ kind: 'success', message: `同步完成：写入 ${result.written.length} 项` })
    } catch (e) {
      pushToast({ kind: 'error', message: `同步失败：${e instanceof Error ? e.message : String(e)}` })
      setStage(s => s.kind === 'executing' ? { kind: 'idle' } : s)
    }
  }

  const isLoading = ['scanning', 'planning', 'dry_running', 'executing'].includes(stage.kind)
  const writableCount = stage.kind === 'plan_done' || stage.kind === 'dry_run_done' || stage.kind === 'execute_done'
    ? (stage.kind === 'plan_done' ? stage.plan : stage.plan).stats.migratable
    : 0

  return (
    <div className="flex-1 overflow-auto p-6 animate-fade-in">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-text-primary">同步中心</h1>
        <p className="mt-1 text-sm text-text-secondary">
          将 Claude Code 的工作习惯（指令、技能、Agent）迁移到 Codex
        </p>
      </div>

      {/* Controls */}
      <div className="bg-surface-card border border-border-default rounded-xl p-4 mb-4 space-y-3">
        <div className="flex items-center gap-4 flex-wrap">
          <div>
            <div className="text-2xs font-medium text-text-tertiary mb-2">迁移范围</div>
            <div className="flex gap-2">
              {(['all', 'global', 'project'] as Scope[]).map((s) => (
                <button
                  key={s}
                  onClick={() => setScope(s)}
                  className={`px-3 py-1.5 rounded-lg text-xs transition-colors ${
                    scope === s ? 'bg-accent-blue text-white' : 'bg-surface-base text-text-secondary hover:bg-surface-hover'
                  }`}
                >
                  {{ all: '全部', global: '仅全局', project: '仅项目' }[s]}
                </button>
              ))}
              {scope === 'project' && !projectPath && (
                <span className="text-2xs text-amber-600 self-center">请先选择项目</span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <label className="flex items-center gap-1.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={overwrite}
                onChange={(e) => setOverwrite(e.target.checked)}
                className="rounded"
              />
              <span className="text-xs text-text-secondary">覆盖模式（强制覆盖已存在文件）</span>
            </label>
            {overwrite && (
              <span className="text-2xs text-amber-600">原文件将自动备份为 .bak.&lt;ts&gt;</span>
            )}
          </div>
        </div>
      </div>

      {/* Stage 1: Scan results */}
      {(stage.kind !== 'idle') && (
        <StagePanel
          step={1}
          title="扫描结果"
          subtitle="检测到的 Claude 侧配置，即将评估迁移可行性"
          loading={stage.kind === 'scanning'}
        >
          {stage.kind !== 'scanning' && (
            <>
              <ScanItemsTable
                items={'items' in stage ? stage.items : 'plan' in stage ? stage.plan.items : []}
                expandedRows={expandedRows}
                toggleRow={toggleRow}
                showStatus={false}
              />
              {stage.kind === 'scan_done' && (
                <div className="px-4 py-3 border-t border-border-subtle bg-surface-base flex items-center justify-between">
                  <span className="text-xs text-text-tertiary">{stage.items.length} 项已扫描</span>
                  <button
                    onClick={runPlan}
                    disabled={isLoading}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-accent-blue text-white rounded-lg text-xs hover:bg-blue-600 transition-colors disabled:opacity-50"
                  >
                    查看转换计划 <ArrowRight size={12} />
                  </button>
                </div>
              )}
            </>
          )}
        </StagePanel>
      )}

      {/* Stage 2: Plan */}
      {(stage.kind === 'plan_done' || stage.kind === 'dry_run_done' || stage.kind === 'execute_done' || stage.kind === 'dry_running' || stage.kind === 'executing' || stage.kind === 'planning') && (
        <StagePanel
          step={2}
          title="转换计划"
          subtitle="每项将如何转换，以及 converter 做的处理"
          loading={stage.kind === 'planning'}
        >
          {stage.kind !== 'planning' && (() => {
            const plan = 'plan' in stage ? stage.plan : null
            if (!plan) return null
            return (
              <>
                <ScanItemsTable
                  items={plan.items}
                  expandedRows={expandedRows}
                  toggleRow={toggleRow}
                  showStatus
                  overwrite={overwrite}
                />
                <div className="px-4 py-2 bg-surface-base border-t border-border-subtle flex items-center gap-4 text-xs">
                  <StatChip label="待同步" count={plan.stats.migratable} color="text-green-600" />
                  <StatChip label="需检查" count={plan.stats.needs_conversion} color="text-yellow-600" />
                  <StatChip label="不可迁移" count={plan.stats.unsupported} color="text-text-tertiary" />
                </div>
                {(stage.kind === 'plan_done') && (
                  <div className="px-4 py-3 border-t border-border-subtle bg-surface-base flex items-center justify-end">
                    <button
                      onClick={() => runDryRun(plan)}
                      disabled={isLoading || plan.stats.migratable === 0}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-accent-blue text-white rounded-lg text-xs hover:bg-blue-600 transition-colors disabled:opacity-50"
                    >
                      预演（Dry Run）<ArrowRight size={12} />
                    </button>
                  </div>
                )}
              </>
            )
          })()}
        </StagePanel>
      )}

      {/* Stage 3: Dry run */}
      {(stage.kind === 'dry_run_done' || stage.kind === 'executing' || stage.kind === 'execute_done') && (
        <StagePanel
          step={3}
          title="预演结果"
          subtitle="模拟写入 — 无实际变更"
          loading={false}
        >
          {(() => {
            const dr = stage.kind === 'dry_run_done' ? stage.dryRun :
                       stage.kind === 'executing' || stage.kind === 'execute_done' ? (stage as any).dryRun : null
            const plan = 'plan' in stage ? stage.plan : null
            if (!dr || !plan) return null
            return (
              <>
                <ScanItemsTable
                  items={dr.items}
                  expandedRows={expandedRows}
                  toggleRow={toggleRow}
                  showStatus
                  showDryRunAction
                  overwrite={overwrite}
                />
                <div className="px-4 py-2 bg-surface-base border-t border-border-subtle flex items-center gap-4 text-xs">
                  <span className="text-green-600">将写入 {dr.would_write.length} 项</span>
                  <span className="text-text-tertiary">将跳过 {dr.would_skip.length} 项</span>
                </div>
                {stage.kind === 'dry_run_done' && (
                  <div className="px-4 py-3 border-t border-border-subtle bg-surface-base flex items-center justify-end gap-3">
                    <span className="text-xs text-text-tertiary">确认无误后执行</span>
                    <button
                      onClick={() => runExecute(plan)}
                      disabled={isLoading || dr.would_write.length === 0}
                      className="flex items-center gap-1.5 px-4 py-1.5 bg-accent-blue text-white rounded-lg text-xs hover:bg-blue-600 transition-colors disabled:opacity-50"
                    >
                      <RefreshCw size={12} />
                      执行同步（{dr.would_write.length} 项）
                    </button>
                  </div>
                )}
              </>
            )
          })()}
        </StagePanel>
      )}

      {/* Stage 4: Execute result */}
      {stage.kind === 'execute_done' && (
        <StagePanel step={4} title="执行报告" subtitle="实际写入结果" loading={false}>
          <ExecuteReport result={stage.result} />
        </StagePanel>
      )}
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StagePanel({
  step, title, subtitle, loading, children,
}: {
  step: number; title: string; subtitle: string; loading: boolean; children?: React.ReactNode
}) {
  return (
    <div className="bg-surface-card border border-border-default rounded-xl overflow-hidden mb-4">
      <div className="px-4 py-3 border-b border-border-subtle flex items-center gap-3 bg-surface-base/50">
        <span className="w-6 h-6 rounded-full bg-accent-blue text-white text-xs flex items-center justify-center font-medium flex-shrink-0">
          {step}
        </span>
        <div className="flex-1">
          <div className="text-sm font-medium text-text-primary">{title}</div>
          <div className="text-2xs text-text-tertiary">{subtitle}</div>
        </div>
        {loading && <RefreshCw size={14} className="text-text-tertiary animate-spin flex-shrink-0" />}
      </div>
      {loading ? (
        <div className="px-4 py-6 text-center text-sm text-text-tertiary">
          <RefreshCw size={20} className="animate-spin mx-auto mb-2 text-accent-blue/50" />
          处理中…
        </div>
      ) : children}
    </div>
  )
}

function ScanItemsTable({
  items, expandedRows, toggleRow, showStatus, showDryRunAction = false, overwrite = false,
}: {
  items: ApiSyncItem[]
  expandedRows: Set<string>
  toggleRow: (k: string) => void
  showStatus: boolean
  showDryRunAction?: boolean
  overwrite?: boolean
}) {
  if (items.length === 0)
    return <p className="px-4 py-6 text-sm text-text-tertiary text-center">没有找到可迁移的项目</p>

  const actionable = items.filter((i) => i.status !== 'unsupported')
  const unsupported = items.filter((i) => i.status === 'unsupported')

  return (
    <div className="divide-y divide-border-subtle">
      {actionable.map((item, i) => {
        const rowKey = `${item.type}:${item.name}`
        const expanded = expandedRows.has(rowKey)
        const hasWarnings = (item.warnings?.length ?? 0) > 0
        const statusConf = showDryRunAction && item.dry_run_action
          ? DRY_RUN_LABEL[item.dry_run_action] ?? DRY_RUN_LABEL.unknown
          : STATUS_LABEL[item.status] ?? STATUS_LABEL.not_added
        const willOverwrite = overwrite && item.dry_run_action === 'would_skip' && item.status !== 'unsupported'

        return (
          <div key={rowKey}>
            <div
              className="px-4 py-2.5 flex items-center gap-3 hover:bg-surface-hover cursor-pointer transition-colors"
              onClick={() => (hasWarnings || item.notes) && toggleRow(rowKey)}
            >
              <span className={`text-2xs px-1.5 py-0.5 rounded font-medium flex-shrink-0 ${TYPE_BADGE[item.type] ?? 'bg-gray-100 text-gray-600'}`}>
                {item.type}
              </span>
              <span className="text-xs font-medium text-text-primary flex-1 truncate">{item.name}</span>
              <span className="text-2xs text-text-tertiary font-mono truncate max-w-48 hidden sm:block">
                {item.source.split('/').slice(-2).join('/')}
              </span>
              {item.target && (
                <>
                  <ArrowRight size={11} className="text-border-default flex-shrink-0" />
                  <span className="text-2xs text-text-tertiary font-mono truncate max-w-48 hidden sm:block">
                    {item.target.split('/').slice(-2).join('/')}
                  </span>
                </>
              )}
              {showStatus && (
                <span className={`text-2xs px-1.5 py-0.5 rounded font-medium flex-shrink-0 ${willOverwrite ? 'text-orange-700 bg-orange-50' : statusConf.color}`}>
                  {willOverwrite ? '将覆盖' : statusConf.label}
                </span>
              )}
              {(hasWarnings || item.notes) && (
                <span className="text-text-tertiary flex-shrink-0">
                  {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                </span>
              )}
            </div>
            {expanded && (
              <div className="px-4 pb-3 bg-surface-base border-t border-border-subtle space-y-2">
                {item.notes && (
                  <p className="text-xs text-text-secondary pt-2">{item.notes}</p>
                )}
                {item.warnings && item.warnings.length > 0 && (
                  <div className="space-y-1">
                    {item.warnings.map((w, wi) => (
                      <div key={wi} className="flex items-start gap-2 text-2xs text-yellow-700 bg-yellow-50 px-2.5 py-1.5 rounded-lg">
                        <Zap size={10} className="flex-shrink-0 mt-0.5" />
                        <span>{w}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
      {unsupported.length > 0 && (
        <UnsupportedGroup items={unsupported} expandedRows={expandedRows} toggleRow={toggleRow} />
      )}
    </div>
  )
}

function UnsupportedGroup({
  items, expandedRows, toggleRow,
}: {
  items: ApiSyncItem[]
  expandedRows: Set<string>
  toggleRow: (k: string) => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <div>
      <div
        className="px-4 py-2 flex items-center gap-2 cursor-pointer hover:bg-surface-hover transition-colors text-xs text-text-tertiary"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        <span>不可迁移 ({items.length} 项)</span>
      </div>
      {open && items.map((item) => {
        const rowKey = `${item.type}:${item.name}`
        const expanded = expandedRows.has(rowKey)
        return (
          <div key={rowKey}>
            <div
              className="px-4 py-2 flex items-center gap-3 hover:bg-surface-hover cursor-pointer transition-colors"
              onClick={() => item.notes && toggleRow(rowKey)}
            >
              <span className={`text-2xs px-1.5 py-0.5 rounded font-medium flex-shrink-0 ${TYPE_BADGE[item.type] ?? 'bg-gray-100 text-gray-600'} opacity-50`}>
                {item.type}
              </span>
              <span className="text-xs text-text-tertiary flex-1 truncate">{item.name}</span>
              <span className="text-2xs text-text-tertiary px-1.5 py-0.5 rounded bg-surface-base">不可迁移</span>
              {item.notes && <ChevronRight size={12} className={`text-text-tertiary flex-shrink-0 ${expanded ? 'rotate-90' : ''}`} />}
            </div>
            {expanded && item.notes && (
              <div className="px-4 pb-2 bg-surface-base border-t border-border-subtle">
                <p className="text-xs text-text-tertiary pt-2">{item.notes}</p>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function ExecuteReport({ result }: { result: ApiSyncResult }) {
  const groups = [
    { label: `已写入（${result.written.length}）`, paths: result.written, color: 'text-green-600' },
    { label: `已跳过（${result.skipped.length}）`, paths: result.skipped, color: 'text-text-tertiary' },
    ...(result.errors?.length ? [{ label: `失败（${result.errors.length}）`, paths: result.errors, color: 'text-red-600' }] : []),
  ].filter((g) => g.paths.length > 0)

  if (groups.length === 0) return <p className="px-4 py-6 text-sm text-text-tertiary text-center">无写入结果</p>

  return (
    <div className="divide-y divide-border-subtle">
      {groups.map((g) => (
        <div key={g.label} className="px-4 py-3">
          <div className={`text-xs font-medium mb-2 ${g.color}`}>{g.label}</div>
          <div className="space-y-1">
            {g.paths.map((p) => (
              <div key={p} className="text-2xs font-mono text-text-secondary bg-surface-base px-2 py-1 rounded">{p}</div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function StatChip({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <span className={`${color}`}>
      <span className="font-medium">{count}</span> {label}
    </span>
  )
}
