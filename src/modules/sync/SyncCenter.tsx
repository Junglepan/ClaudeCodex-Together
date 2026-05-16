import { useState, useEffect, useCallback } from 'react'
import { RefreshCw, ChevronDown, ChevronRight, CheckCircle, AlertCircle, XCircle, ArrowRight, ArrowLeft, Zap, Square, CheckSquare, MinusSquare, Play, FileText, Shield, GitCompare, Bot, Plug, Terminal, Settings, Package } from 'lucide-react'
import { api } from '@/core/api'
import { useAppStore } from '@/store'
import type { ApiSyncItem, ApiSyncPlan, ApiSyncDryRunResult, ApiSyncResult, ApiValidationResult, StructuredWarnings } from '@/core/api'

type Scope = 'all' | 'global' | 'project'

type Stage =
  | { kind: 'idle' }
  | { kind: 'scanning' }
  | { kind: 'scan_done'; items: ApiSyncItem[] }
  | { kind: 'planning' }
  | { kind: 'plan_done'; plan: ApiSyncPlan }
  | { kind: 'dry_running' }
  | { kind: 'dry_run_done'; dryRun: ApiSyncDryRunResult; plan: ApiSyncPlan }
  | { kind: 'executing'; dryRun: ApiSyncDryRunResult; plan: ApiSyncPlan }
  | { kind: 'execute_done'; result: ApiSyncResult; dryRun: ApiSyncDryRunResult; plan: ApiSyncPlan }
  | { kind: 'validating'; result: ApiSyncResult; dryRun: ApiSyncDryRunResult; plan: ApiSyncPlan }
  | { kind: 'validated'; result: ApiSyncResult; validation: ApiValidationResult; dryRun: ApiSyncDryRunResult; plan: ApiSyncPlan }

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  added:       { label: '待同步',       color: 'text-green-700 bg-green-50' },
  check:       { label: '需人工检查',   color: 'text-yellow-700 bg-yellow-50' },
  conflict:    { label: '有冲突',       color: 'text-orange-700 bg-orange-50' },
  unsupported: { label: '不可迁移',     color: 'text-text-tertiary bg-surface-base' },
  not_added:   { label: '已同步',       color: 'text-text-tertiary bg-surface-base' },
}

const DRY_RUN_LABEL: Record<string, { label: string; color: string }> = {
  would_write:      { label: '将写入',   color: 'text-green-700 bg-green-50' },
  would_skip:       { label: '将跳过',   color: 'text-text-tertiary bg-surface-base' },
  would_overwrite:  { label: '将覆盖',   color: 'text-orange-700 bg-orange-50' },
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
  MCP:         'bg-teal-50 text-teal-700',
  Plugin:      'bg-rose-50 text-rose-700',
}

export function SyncCenter() {
  const [view, setView] = useState<'overview' | 'flow'>('overview')

  return (
    <div className="flex-1 overflow-auto p-6 animate-fade-in">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-text-primary">同步中心</h1>
        <p className="mt-1 text-sm text-text-secondary">
          将 Claude Code 的配置（指令、技能、Agent、Hooks、MCP）迁移到 Codex
        </p>
      </div>

      {view === 'overview' ? (
        <SyncOverview onStartFlow={() => setView('flow')} />
      ) : (
        <SyncFlow onBack={() => setView('overview')} />
      )}
    </div>
  )
}

// ── Overview ─────────────────────────────────────────────────────────────────

const SURFACE_ROWS: Array<{ type: string; icon: typeof FileText; source: string; target: string; note: string; badge: string }> = [
  { type: 'Instruction', icon: FileText, source: 'CLAUDE.md', target: 'AGENTS.md', note: '中立内容直接复制；含 Claude 专有标记时提示审查', badge: TYPE_BADGE.Instruction },
  { type: 'Skill', icon: GitCompare, source: '.claude/skills/*/SKILL.md', target: '.agents/skills/*/SKILL.md', note: '保留 frontmatter，allowed-tools 转为提示引导', badge: TYPE_BADGE.Skill },
  { type: 'Subagent', icon: Bot, source: '.claude/agents/*.md', target: '.codex/agents/*.toml', note: '模型/effort/权限映射 + tools 转为 prompt guidance', badge: TYPE_BADGE.Subagent },
  { type: 'Command', icon: Terminal, source: '.claude/commands/*.md', target: '.agents/skills/source-command-*/', note: '转换为 Codex skill，模板占位符保留需审查', badge: TYPE_BADGE.Command },
  { type: 'Hook', icon: Shield, source: 'settings.json → hooks', target: '.codex/hooks.json', note: '仅迁移 command 类型，需启用 codex_hooks', badge: TYPE_BADGE.Hook },
  { type: 'Settings', icon: Settings, source: 'settings.json + .mcp.json', target: '.codex/config.toml', note: '模型映射 + MCP 服务器配置 + personality=friendly', badge: TYPE_BADGE.Settings },
  { type: 'Plugin', icon: Package, source: '.claude/plugins/', target: '—', note: '仅报告，需手动迁移', badge: TYPE_BADGE.Plugin },
]

const FLOW_STEPS = [
  { step: 1, label: '扫描', desc: '检测 Claude 侧可迁移的配置项' },
  { step: 2, label: '计划', desc: '生成转换计划，逐项展示对比和状态' },
  { step: 3, label: '预演', desc: '模拟写入，预览目标文件变更' },
  { step: 4, label: '执行', desc: '实际写入 Codex 目标文件' },
  { step: 5, label: '验证', desc: '检查目标文件格式和可用性' },
]

function SyncOverview({ onStartFlow }: { onStartFlow: () => void }) {
  return (
    <div className="space-y-4">
      {/* Direction card */}
      <div className="bg-surface-card border border-border-default rounded-xl p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
            <GitCompare size={16} className="text-accent-blue" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-text-primary">Claude → Codex 单向迁移</h2>
            <p className="text-2xs text-text-tertiary">转换规则对齐 Codex 官方 migrate-to-codex skill</p>
          </div>
          <button
            onClick={onStartFlow}
            className="ml-auto flex items-center gap-2 px-4 py-2 bg-accent-blue text-white rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors"
          >
            <Play size={14} />
            开始同步流程
          </button>
        </div>

        {/* Flow steps */}
        <div className="flex items-center gap-1 mb-1">
          {FLOW_STEPS.map((s, i) => (
            <div key={s.step} className="flex items-center gap-1">
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-surface-base rounded-lg">
                <span className="w-4 h-4 rounded-full bg-accent-blue/10 text-accent-blue text-2xs flex items-center justify-center font-medium">{s.step}</span>
                <span className="text-2xs font-medium text-text-secondary">{s.label}</span>
              </div>
              {i < FLOW_STEPS.length - 1 && <ArrowRight size={10} className="text-border-default" />}
            </div>
          ))}
        </div>
      </div>

      {/* Conversion rules table */}
      <div className="bg-surface-card border border-border-default rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border-subtle">
          <h3 className="text-sm font-medium text-text-primary">转换规则一览</h3>
          <p className="text-2xs text-text-tertiary mt-0.5">每种配置类型的来源、目标和转换方式</p>
        </div>
        <div className="divide-y divide-border-subtle">
          {SURFACE_ROWS.map((row) => (
            <div key={row.type} className="px-4 py-3 flex items-start gap-3">
              <row.icon size={14} className="text-text-tertiary mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-2xs px-1.5 py-0.5 rounded font-medium ${row.badge}`}>{row.type}</span>
                </div>
                <div className="flex items-center gap-2 text-2xs font-mono text-text-secondary mb-1">
                  <span className="truncate">{row.source}</span>
                  <ArrowRight size={10} className="text-border-default flex-shrink-0" />
                  <span className="truncate">{row.target}</span>
                </div>
                <p className="text-2xs text-text-tertiary">{row.note}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Model mapping card */}
      <div className="bg-surface-card border border-border-default rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border-subtle">
          <h3 className="text-sm font-medium text-text-primary">模型与权限映射</h3>
        </div>
        <div className="p-4 grid grid-cols-2 gap-4">
          <div>
            <div className="text-2xs font-medium text-text-tertiary mb-2">模型映射</div>
            <div className="space-y-1">
              {[
                ['claude-opus-*', 'gpt-5.4'],
                ['claude-sonnet-*', 'gpt-5.4-mini'],
                ['claude-haiku-*', 'gpt-5.4-mini'],
              ].map(([from, to]) => (
                <div key={from} className="flex items-center gap-2 text-2xs">
                  <code className="px-1.5 py-0.5 bg-surface-base rounded font-mono text-text-secondary">{from}</code>
                  <ArrowRight size={10} className="text-border-default" />
                  <code className="px-1.5 py-0.5 bg-green-50 rounded font-mono text-green-700">{to}</code>
                </div>
              ))}
            </div>
          </div>
          <div>
            <div className="text-2xs font-medium text-text-tertiary mb-2">权限映射</div>
            <div className="space-y-1">
              {[
                ['acceptEdits', 'workspace-write'],
                ['readOnly', 'read-only'],
              ].map(([from, to]) => (
                <div key={from} className="flex items-center gap-2 text-2xs">
                  <code className="px-1.5 py-0.5 bg-surface-base rounded font-mono text-text-secondary">{from}</code>
                  <ArrowRight size={10} className="text-border-default" />
                  <code className="px-1.5 py-0.5 bg-green-50 rounded font-mono text-green-700">{to}</code>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Sync Flow ────────────────────────────────────────────────────────────────

function stageToStep(kind: Stage['kind']): number {
  switch (kind) {
    case 'idle': case 'scanning': case 'scan_done': return 1
    case 'planning': case 'plan_done': return 2
    case 'dry_running': case 'dry_run_done': return 3
    case 'executing': case 'execute_done': return 4
    case 'validating': case 'validated': return 5
  }
}

function SyncFlow({ onBack }: { onBack: () => void }) {
  const { projectPath, pushToast } = useAppStore()
  const [scope, setScope]       = useState<Scope>('all')
  const [overwrite, setOverwrite] = useState(false)
  const [stage, setStage]       = useState<Stage>({ kind: 'idle' })
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())
  const [selectedIds, setSelectedIds]   = useState<Set<string>>(new Set())
  const [viewStep, setViewStep] = useState(1)

  const currentStep = stageToStep(stage.kind)
  const reachedStep = currentStep

  const toggleRow = (key: string) =>
    setExpandedRows((s) => { const n = new Set(s); n.has(key) ? n.delete(key) : n.add(key); return n })

  const runScan = useCallback(async () => {
    setStage({ kind: 'scanning' })
    setViewStep(1)
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
    setViewStep(2)
    try {
      const plan = await api.sync.plan(scope, projectPath, overwrite)
      const actionableIds = plan.items
        .filter((i) => i.id && i.status !== 'unsupported')
        .map((i) => i.id!)
      setSelectedIds(new Set(actionableIds))
      setStage({ kind: 'plan_done', plan })
    } catch (e) {
      pushToast({ kind: 'error', message: `计划失败：${e instanceof Error ? e.message : String(e)}` })
      setStage(s => s.kind === 'planning' ? { kind: 'idle' } : s)
      setViewStep(1)
    }
  }

  const runDryRun = async (plan: ApiSyncPlan) => {
    const ids = [...selectedIds]
    setStage({ kind: 'dry_running' })
    setViewStep(3)
    try {
      const dr = await api.sync.dryRun(scope, projectPath, overwrite, ids.length > 0 ? ids : undefined)
      setStage({ kind: 'dry_run_done', dryRun: dr, plan })
      pushToast({ kind: 'success', message: `预演完成：${dr.would_write.length} 项将写入` })
    } catch (e) {
      pushToast({ kind: 'error', message: `预演失败：${e instanceof Error ? e.message : String(e)}` })
      setStage({ kind: 'plan_done', plan })
      setViewStep(2)
    }
  }

  const runExecute = async (plan: ApiSyncPlan) => {
    if (stage.kind !== 'dry_run_done') return
    const dryRun = stage.dryRun
    const ids = [...selectedIds]
    setStage({ kind: 'executing', dryRun, plan })
    setViewStep(4)
    try {
      const result = await api.sync.execute(scope, projectPath, overwrite, ids.length > 0 ? ids : undefined)
      setStage({ kind: 'execute_done', result, dryRun, plan })
      pushToast({ kind: 'success', message: `同步完成：写入 ${result.written.length} 项，覆盖 ${result.overwritten.length} 项` })
    } catch (e) {
      pushToast({ kind: 'error', message: `同步失败：${e instanceof Error ? e.message : String(e)}` })
      setStage(s => s.kind === 'executing' ? { kind: 'idle' } : s)
      setViewStep(3)
    }
  }

  const runValidate = async () => {
    if (stage.kind !== 'execute_done') return
    const { result, dryRun, plan } = stage
    setStage({ kind: 'validating', result, dryRun, plan })
    setViewStep(5)
    try {
      const validation = await api.sync.validate(scope, projectPath)
      setStage({ kind: 'validated', result, validation, dryRun, plan })
    } catch (e) {
      pushToast({ kind: 'error', message: `验证失败：${e instanceof Error ? e.message : String(e)}` })
      setStage({ kind: 'execute_done', result, dryRun, plan })
      setViewStep(4)
    }
  }

  const downloadReport = async () => {
    if (stage.kind !== 'execute_done' && stage.kind !== 'validated') return
    try {
      const validation = stage.kind === 'validated' ? stage.validation : undefined
      const markdown = await api.sync.report(stage.result, validation)
      const blob = new Blob([markdown], { type: 'text/markdown' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `migration-report-${new Date().toISOString().slice(0, 10)}.md`
      a.click()
      URL.revokeObjectURL(url)
      pushToast({ kind: 'success', message: '报告已下载' })
    } catch (e) {
      pushToast({ kind: 'error', message: `生成报告失败：${e instanceof Error ? e.message : String(e)}` })
    }
  }

  const isLoading = ['scanning', 'planning', 'dry_running', 'executing', 'validating'].includes(stage.kind)

  return (
    <div className="space-y-4">
      {/* Top bar: back + controls */}
      <div className="bg-surface-card border border-border-default rounded-xl p-4">
        <div className="flex items-center gap-4 flex-wrap">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-text-secondary hover:text-text-primary bg-surface-base rounded-lg hover:bg-surface-hover transition-colors"
          >
            <ArrowLeft size={12} />
            返回概览
          </button>

          <div className="h-4 w-px bg-border-default" />

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

          <div className="flex items-center gap-2 ml-auto">
            <label className="flex items-center gap-1.5 cursor-pointer select-none">
              <input type="checkbox" checked={overwrite} onChange={(e) => setOverwrite(e.target.checked)} className="rounded" />
              <span className="text-xs text-text-secondary">覆盖模式</span>
            </label>
            {overwrite && <span className="text-2xs text-amber-600">原文件自动备份</span>}
          </div>
        </div>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-1">
        {FLOW_STEPS.map((s, i) => {
          const reached = s.step <= reachedStep
          const active = s.step === viewStep
          const clickable = reached && s.step !== viewStep
          return (
            <div key={s.step} className="flex items-center gap-1">
              <button
                disabled={!clickable}
                onClick={() => clickable && setViewStep(s.step)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-2xs font-medium transition-colors ${
                  active
                    ? 'bg-accent-blue text-white'
                    : reached
                      ? 'bg-surface-card border border-border-default text-text-secondary hover:bg-surface-hover cursor-pointer'
                      : 'bg-surface-base text-text-tertiary/50 cursor-default'
                }`}
              >
                <span className={`w-4 h-4 rounded-full text-2xs flex items-center justify-center font-medium ${
                  active
                    ? 'bg-white/20 text-white'
                    : reached
                      ? 'bg-accent-blue/10 text-accent-blue'
                      : 'bg-surface-hover text-text-tertiary/50'
                }`}>{s.step}</span>
                {s.label}
              </button>
              {i < FLOW_STEPS.length - 1 && <ArrowRight size={10} className="text-border-default" />}
            </div>
          )
        })}
      </div>

      {/* Step 1: Scan results */}
      {viewStep === 1 && stage.kind !== 'idle' && (
        <StagePanel step={1} title="扫描结果" subtitle="检测到的 Claude 侧配置" loading={stage.kind === 'scanning'}>
          {stage.kind !== 'scanning' && (
            <>
              <ScanItemsTable
                items={'items' in stage ? stage.items : 'plan' in stage ? stage.plan.items : []}
                expandedRows={expandedRows}
                toggleRow={toggleRow}
                showStatus={false}
              />
              <div className="px-4 py-3 border-t border-border-subtle bg-surface-base flex items-center justify-between">
                <span className="text-xs text-text-tertiary">
                  {('items' in stage ? stage.items : 'plan' in stage ? stage.plan.items : []).length} 项已扫描
                </span>
                {stage.kind === 'scan_done' ? (
                  <button onClick={runPlan} disabled={isLoading} className="flex items-center gap-1.5 px-3 py-1.5 bg-accent-blue text-white rounded-lg text-xs hover:bg-blue-600 transition-colors disabled:opacity-50">
                    查看转换计划 <ArrowRight size={12} />
                  </button>
                ) : reachedStep >= 2 ? (
                  <button onClick={() => setViewStep(2)} className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-base border border-border-default text-text-secondary rounded-lg text-xs hover:bg-surface-hover transition-colors">
                    查看转换计划 <ArrowRight size={12} />
                  </button>
                ) : null}
              </div>
            </>
          )}
        </StagePanel>
      )}

      {/* Step 2: Plan */}
      {viewStep === 2 && reachedStep >= 2 && (
        <StagePanel step={2} title="转换计划" subtitle="每项将如何转换" loading={stage.kind === 'planning'}>
          {stage.kind !== 'planning' && (() => {
            const plan = 'plan' in stage ? stage.plan : null
            if (!plan) return null
            const selectable = stage.kind === 'plan_done'
            return (
              <>
                <ScanItemsTable
                  items={plan.items}
                  expandedRows={expandedRows}
                  toggleRow={toggleRow}
                  showStatus
                  overwrite={overwrite}
                  selectable={selectable}
                  selectedIds={selectedIds}
                  onToggleSelect={(id) => setSelectedIds((prev) => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next })}
                  onToggleAll={(ids, select) => setSelectedIds((prev) => { const next = new Set(prev); ids.forEach((id) => select ? next.add(id) : next.delete(id)); return next })}
                />
                <div className="px-4 py-2 bg-surface-base border-t border-border-subtle flex items-center gap-4 text-xs">
                  <StatChip label="待同步" count={plan.stats.migratable} color="text-green-600" />
                  <StatChip label="需检查" count={plan.stats.needs_conversion} color="text-yellow-600" />
                  <StatChip label="不可迁移" count={plan.stats.unsupported} color="text-text-tertiary" />
                  {selectable && <span className="ml-auto text-text-tertiary">已选 {selectedIds.size} 项</span>}
                </div>
                <div className="px-4 py-3 border-t border-border-subtle bg-surface-base flex items-center justify-between">
                  <button onClick={() => setViewStep(1)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-text-secondary bg-surface-base border border-border-default rounded-lg hover:bg-surface-hover transition-colors">
                    <ArrowLeft size={12} /> 扫描结果
                  </button>
                  {stage.kind === 'plan_done' ? (
                    <button onClick={() => runDryRun(plan)} disabled={isLoading || selectedIds.size === 0} className="flex items-center gap-1.5 px-3 py-1.5 bg-accent-blue text-white rounded-lg text-xs hover:bg-blue-600 transition-colors disabled:opacity-50">
                      预演选中项（{selectedIds.size}）<ArrowRight size={12} />
                    </button>
                  ) : reachedStep >= 3 ? (
                    <button onClick={() => setViewStep(3)} className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-base border border-border-default text-text-secondary rounded-lg text-xs hover:bg-surface-hover transition-colors">
                      查看预演结果 <ArrowRight size={12} />
                    </button>
                  ) : null}
                </div>
              </>
            )
          })()}
        </StagePanel>
      )}

      {/* Step 3: Dry run */}
      {viewStep === 3 && reachedStep >= 3 && (
        <StagePanel step={3} title="预演结果" subtitle="模拟写入 — 无实际变更" loading={stage.kind === 'dry_running'}>
          {stage.kind !== 'dry_running' && (() => {
            const dr = 'dryRun' in stage ? stage.dryRun : null
            const plan = 'plan' in stage ? stage.plan : null
            if (!dr || !plan) return null
            return (
              <>
                <ScanItemsTable items={dr.items} expandedRows={expandedRows} toggleRow={toggleRow} showStatus showDryRunAction overwrite={overwrite} />
                <div className="px-4 py-2 bg-surface-base border-t border-border-subtle flex items-center gap-4 text-xs">
                  <span className="text-green-600">将写入 {dr.would_write.length} 项</span>
                  <span className="text-orange-600">将覆盖 {dr.would_overwrite.length} 项</span>
                  <span className="text-text-tertiary">将跳过 {dr.would_skip.length} 项</span>
                </div>
                <div className="px-4 py-3 border-t border-border-subtle bg-surface-base flex items-center justify-between">
                  <button onClick={() => setViewStep(2)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-text-secondary bg-surface-base border border-border-default rounded-lg hover:bg-surface-hover transition-colors">
                    <ArrowLeft size={12} /> 转换计划
                  </button>
                  {stage.kind === 'dry_run_done' ? (
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-text-tertiary">确认无误后执行</span>
                      <button onClick={() => runExecute(plan)} disabled={isLoading || (dr.would_write.length + dr.would_overwrite.length) === 0} className="flex items-center gap-1.5 px-4 py-1.5 bg-accent-blue text-white rounded-lg text-xs hover:bg-blue-600 transition-colors disabled:opacity-50">
                        <RefreshCw size={12} /> 执行同步（{dr.would_write.length + dr.would_overwrite.length} 项）
                      </button>
                    </div>
                  ) : reachedStep >= 4 ? (
                    <button onClick={() => setViewStep(4)} className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-base border border-border-default text-text-secondary rounded-lg text-xs hover:bg-surface-hover transition-colors">
                      查看执行报告 <ArrowRight size={12} />
                    </button>
                  ) : null}
                </div>
              </>
            )
          })()}
        </StagePanel>
      )}

      {/* Step 4: Execute result */}
      {viewStep === 4 && reachedStep >= 4 && (
        <StagePanel step={4} title="执行报告" subtitle="实际写入结果" loading={stage.kind === 'executing'}>
          {stage.kind !== 'executing' && 'result' in stage && (
            <>
              <ExecuteReport result={stage.result} />
              <div className="px-4 py-3 border-t border-border-subtle flex items-center justify-between">
                <button onClick={() => setViewStep(3)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-text-secondary bg-surface-base border border-border-default rounded-lg hover:bg-surface-hover transition-colors">
                  <ArrowLeft size={12} /> 预演结果
                </button>
                <div className="flex items-center gap-2">
                  <button onClick={downloadReport} className="px-3 py-1.5 text-xs font-medium text-text-secondary bg-surface-base border border-border-default rounded-lg hover:bg-surface-hover transition-colors">
                    下载迁移报告
                  </button>
                  {stage.kind === 'execute_done' && (
                    <button onClick={runValidate} className="px-3 py-1.5 text-xs font-medium text-white bg-accent-blue rounded-lg hover:bg-accent-blue/90 transition-colors">
                      验证目标文件 <ArrowRight size={12} className="inline ml-1" />
                    </button>
                  )}
                  {reachedStep >= 5 && stage.kind !== 'execute_done' && (
                    <button onClick={() => setViewStep(5)} className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-base border border-border-default text-text-secondary rounded-lg text-xs hover:bg-surface-hover transition-colors">
                      查看验证结果 <ArrowRight size={12} />
                    </button>
                  )}
                </div>
              </div>
            </>
          )}
        </StagePanel>
      )}

      {/* Step 5: Validation result */}
      {viewStep === 5 && reachedStep >= 5 && (
        <StagePanel step={5} title="验证结果" subtitle="检查目标文件可用性" loading={stage.kind === 'validating'}>
          {stage.kind === 'validated' && (
            <>
              <ValidationReport validation={stage.validation} />
              <div className="px-4 py-3 border-t border-border-subtle flex items-center justify-between">
                <button onClick={() => setViewStep(4)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-text-secondary bg-surface-base border border-border-default rounded-lg hover:bg-surface-hover transition-colors">
                  <ArrowLeft size={12} /> 执行报告
                </button>
                <button onClick={downloadReport} className="px-3 py-1.5 text-xs font-medium text-text-secondary bg-surface-base border border-border-default rounded-lg hover:bg-surface-hover transition-colors">
                  下载迁移报告
                </button>
              </div>
            </>
          )}
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
  selectable = false, selectedIds, onToggleSelect, onToggleAll,
}: {
  items: ApiSyncItem[]
  expandedRows: Set<string>
  toggleRow: (k: string) => void
  showStatus: boolean
  showDryRunAction?: boolean
  overwrite?: boolean
  selectable?: boolean
  selectedIds?: Set<string>
  onToggleSelect?: (id: string) => void
  onToggleAll?: (ids: string[], select: boolean) => void
}) {
  if (items.length === 0)
    return <p className="px-4 py-6 text-sm text-text-tertiary text-center">没有找到可迁移的项目</p>

  const actionable = items.filter((i) => i.status !== 'unsupported')
  const unsupported = items.filter((i) => i.status === 'unsupported')
  const actionableIds = actionable.map((i) => i.id).filter(Boolean) as string[]
  const allSelected = selectable && actionableIds.length > 0 && actionableIds.every((id) => selectedIds?.has(id))
  const someSelected = selectable && actionableIds.some((id) => selectedIds?.has(id))

  return (
    <div className="divide-y divide-border-subtle">
      {selectable && actionableIds.length > 0 && (
        <div className="px-4 py-2 flex items-center gap-2 bg-surface-base/50">
          <button
            onClick={() => onToggleAll?.(actionableIds, !allSelected)}
            className="text-text-tertiary hover:text-text-secondary transition-colors flex-shrink-0"
            title={allSelected ? '取消全选' : '全选'}
          >
            {allSelected
              ? <CheckSquare size={14} className="text-accent-blue" />
              : someSelected
                ? <MinusSquare size={14} className="text-accent-blue" />
                : <Square size={14} />}
          </button>
          <span className="text-2xs text-text-tertiary">
            {allSelected ? '取消全选' : '全选可同步项'}
          </span>
        </div>
      )}
      {actionable.map((item, i) => {
        const rowKey = `${item.type}:${item.name}`
        const expanded = expandedRows.has(rowKey)
        const hasWarnings = (item.warnings?.length ?? 0) > 0
        const hasStructured = item.structured_warnings != null && (
          item.structured_warnings.removed_lines.length > 0 ||
          item.structured_warnings.tool_comments.length > 0 ||
          item.structured_warnings.check_lines.length > 0
        )
        const hasContent = item.source_content != null && item.target_content != null
        const expandable = hasWarnings || hasStructured || !!item.notes || hasContent
        const statusConf = showDryRunAction && item.dry_run_action
          ? DRY_RUN_LABEL[item.dry_run_action] ?? DRY_RUN_LABEL.unknown
          : STATUS_LABEL[item.status] ?? STATUS_LABEL.not_added
        const willOverwrite = item.dry_run_action === 'would_overwrite'
        const isSelected = selectable && item.id ? selectedIds?.has(item.id) : false

        return (
          <div key={rowKey}>
            <div
              className="px-4 py-2.5 flex items-center gap-3 hover:bg-surface-hover cursor-pointer transition-colors"
              onClick={() => expandable && toggleRow(rowKey)}
            >
              {selectable && item.id && (
                <button
                  onClick={(e) => { e.stopPropagation(); onToggleSelect?.(item.id!) }}
                  className="text-text-tertiary hover:text-text-secondary transition-colors flex-shrink-0"
                >
                  {isSelected
                    ? <CheckSquare size={14} className="text-accent-blue" />
                    : <Square size={14} />}
                </button>
              )}
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
              {expandable && (
                <span className="text-text-tertiary flex-shrink-0">
                  {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                </span>
              )}
            </div>
            {expanded && (
              <ItemExpandedPanel item={item} />
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

type CompareTab = 'convert' | 'target'

function ItemExpandedPanel({ item }: { item: ApiSyncItem }) {
  const [tab, setTab] = useState<CompareTab>('convert')
  const hasConvert = item.source_content != null && item.target_content != null
  const hasTarget = item.target_content != null
  const hasExisting = !!item.existing_content

  return (
    <div className="bg-surface-base border-t border-border-subtle">
      {/* Notes & warnings */}
      {(item.notes || (item.warnings && item.warnings.length > 0) || item.structured_warnings) && (
        <div className="px-4 pt-2 pb-1 space-y-2">
          {item.notes && <p className="text-xs text-text-secondary">{item.notes}</p>}
          {item.structured_warnings ? (
            <StructuredWarningsPanel sw={item.structured_warnings} />
          ) : item.warnings && item.warnings.length > 0 ? (
            <div className="space-y-1">
              {item.warnings.map((w, wi) => (
                <div key={wi} className="flex items-start gap-2 text-2xs text-yellow-700 bg-yellow-50 px-2.5 py-1.5 rounded-lg">
                  <Zap size={10} className="flex-shrink-0 mt-0.5" />
                  <span>{w}</span>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      )}

      {/* Tab bar */}
      {hasConvert && (
        <div className="px-4 pt-2">
          <div className="flex gap-1 border-b border-border-subtle">
            <button
              onClick={() => setTab('convert')}
              className={`px-3 py-1.5 text-2xs font-medium border-b-2 transition-colors ${tab === 'convert' ? 'border-accent-blue text-accent-blue' : 'border-transparent text-text-tertiary hover:text-text-secondary'}`}
            >
              转换对比
              <span className="ml-1 text-text-tertiary">Claude 源 → 转换结果</span>
            </button>
            <button
              onClick={() => setTab('target')}
              className={`px-3 py-1.5 text-2xs font-medium border-b-2 transition-colors ${tab === 'target' ? 'border-accent-blue text-accent-blue' : 'border-transparent text-text-tertiary hover:text-text-secondary'}`}
            >
              目标预览
              <span className="ml-1 text-text-tertiary">{hasExisting ? '当前 Codex 文件 → 同步后' : '新建文件预览'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Content panels */}
      <div className="px-4 pb-3 pt-2">
        {tab === 'convert' && hasConvert && (
          <SideBySideCompare
            leftLabel="Claude 源文件"
            leftContent={item.source_content!}
            rightLabel="转换结果（将写入 Codex）"
            rightContent={item.target_content!}
          />
        )}
        {tab === 'target' && hasTarget && (
          <SideBySideCompare
            leftLabel={hasExisting ? '当前 Codex 文件' : '（文件不存在）'}
            leftContent={item.existing_content ?? ''}
            rightLabel="同步后内容"
            rightContent={item.target_content!}
            highlightNew={!hasExisting}
          />
        )}
      </div>
    </div>
  )
}

function SideBySideCompare({
  leftLabel, leftContent, rightLabel, rightContent, highlightNew = false,
}: {
  leftLabel: string
  leftContent: string
  rightLabel: string
  rightContent: string
  highlightNew?: boolean
}) {
  if (leftContent === rightContent && leftContent) {
    return <p className="text-2xs text-text-tertiary">内容完全一致，无变更</p>
  }

  return (
    <div className="grid grid-cols-2 gap-2">
      <div className="border border-border-default rounded-lg overflow-hidden">
        <div className="px-3 py-1.5 bg-surface-base border-b border-border-subtle text-2xs text-text-tertiary font-medium">
          {leftLabel}
        </div>
        <CodeBlock content={leftContent} variant={leftContent ? 'default' : 'empty'} />
      </div>
      <div className="border border-border-default rounded-lg overflow-hidden">
        <div className={`px-3 py-1.5 border-b border-border-subtle text-2xs font-medium ${highlightNew ? 'bg-green-50 text-green-700' : 'bg-surface-base text-text-tertiary'}`}>
          {rightLabel}
        </div>
        <CodeBlock content={rightContent} variant={highlightNew ? 'new' : 'default'} />
      </div>
    </div>
  )
}

function CodeBlock({ content, variant = 'default' }: { content: string; variant?: 'default' | 'empty' | 'new' }) {
  if (!content && variant === 'empty') {
    return (
      <div className="px-3 py-4 text-center text-2xs text-text-tertiary italic">
        文件不存在
      </div>
    )
  }

  const lines = content.split('\n')
  const bgClass = variant === 'new' ? 'bg-green-50/30' : ''

  return (
    <pre className={`text-2xs font-mono leading-relaxed max-h-64 overflow-auto ${bgClass}`}>
      {lines.map((line, i) => (
        <div key={i} className="px-3 py-0.5 hover:bg-surface-hover/50">
          <span className="inline-block w-7 text-right mr-2 text-text-tertiary/50 select-none">{i + 1}</span>
          {line || ' '}
        </div>
      ))}
    </pre>
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
    { label: `已覆盖（${result.overwritten.length}）`, paths: result.overwritten, color: 'text-orange-600' },
    { label: `已备份（${result.backups.length}）`, paths: result.backups.map((item) => `${item.target} → ${item.backup}`), color: 'text-blue-600' },
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

function ValidationReport({ validation }: { validation: ApiValidationResult }) {
  if (validation.items.length === 0) {
    return <p className="px-4 py-6 text-sm text-text-tertiary text-center">无目标文件需要验证</p>
  }

  const ok = validation.items.filter((i) => i.status === 'ok')
  const warnings = validation.items.filter((i) => i.status === 'warning')
  const errors = validation.items.filter((i) => i.status === 'error')

  return (
    <div className="divide-y divide-border-subtle">
      <div className="px-4 py-3 flex items-center gap-4 text-xs">
        {ok.length > 0 && <span className="text-green-600"><CheckCircle size={12} className="inline mr-1" />{ok.length} 通过</span>}
        {warnings.length > 0 && <span className="text-yellow-600"><AlertCircle size={12} className="inline mr-1" />{warnings.length} 警告</span>}
        {errors.length > 0 && <span className="text-red-600"><XCircle size={12} className="inline mr-1" />{errors.length} 错误</span>}
      </div>
      {validation.items.map((item, i) => {
        const color = item.status === 'ok' ? 'text-green-600' : item.status === 'warning' ? 'text-yellow-600' : 'text-red-600'
        const Icon = item.status === 'ok' ? CheckCircle : item.status === 'warning' ? AlertCircle : XCircle
        return (
          <div key={i} className="px-4 py-2 flex items-start gap-2">
            <Icon size={14} className={`${color} flex-shrink-0 mt-0.5`} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className={`text-2xs px-1.5 py-0.5 rounded font-medium ${TYPE_BADGE[item.type] ?? 'bg-gray-100 text-gray-600'}`}>{item.type}</span>
                <span className="text-xs text-text-secondary font-mono truncate">{item.target.split('/').pop()}</span>
              </div>
              <p className="text-2xs text-text-tertiary mt-0.5">{item.detail}</p>
            </div>
          </div>
        )
      })}
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

function StructuredWarningsPanel({ sw }: { sw: StructuredWarnings }) {
  const hasRemoved = sw.removed_lines.length > 0
  const hasTools = sw.tool_comments.length > 0
  const hasCheckLines = sw.check_lines.length > 0

  if (!hasRemoved && !hasTools && !hasCheckLines) {
    return <p className="text-2xs text-text-tertiary pt-1">内容直接复制，无需转换</p>
  }

  return (
    <div className="space-y-2 pt-1">
      {hasRemoved && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          <div className="text-2xs font-medium text-red-700 mb-1.5">
            ✂ 已检测到 {sw.removed_lines.length} 个 Claude 斜杠命令引用
          </div>
          <div className="space-y-0.5">
            {sw.removed_lines.map((line, i) => (
              <div key={i} className="text-2xs font-mono text-red-600 bg-red-100/50 px-2 py-0.5 rounded">
                {line}
              </div>
            ))}
          </div>
        </div>
      )}
      {hasTools && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          <div className="text-2xs font-medium text-amber-700 mb-1.5">
            🔧 检测到工具名引用（Codex 不使用此字段，需人工确认）
          </div>
          <div className="flex flex-wrap gap-1.5">
            {sw.tool_comments.map((tool) => (
              <span key={tool} className="text-2xs font-mono text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded">
                {tool}
              </span>
            ))}
          </div>
        </div>
      )}
      {hasCheckLines && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2">
          <div className="text-2xs font-medium text-yellow-700 mb-1.5">
            ⚠ 需人工确认的行（共 {sw.check_lines.length} 处）
          </div>
          <div className="space-y-0.5 max-h-32 overflow-auto">
            {sw.check_lines.map((cl, i) => (
              <div key={i} className="text-2xs font-mono text-yellow-700 flex gap-2">
                <span className="text-yellow-500 flex-shrink-0 w-10 text-right">L{cl.line}</span>
                <span className="truncate">{cl.content}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function ContentDiff({ source, target }: { source: string; target: string }) {
  if (source === target) {
    return <p className="text-2xs text-text-tertiary pt-1">内容直接复制，无需转换</p>
  }

  const srcLines = source.split('\n')
  const tgtLines = target.split('\n')
  const maxLines = Math.max(srcLines.length, tgtLines.length)
  const CONTEXT = 3
  const diffs: Array<{ type: 'same' | 'del' | 'add'; line: string }> = []

  for (let i = 0; i < maxLines; i++) {
    const s = srcLines[i]
    const t = tgtLines[i]
    if (s === t) {
      diffs.push({ type: 'same', line: s ?? '' })
    } else {
      if (s != null) diffs.push({ type: 'del', line: s })
      if (t != null) diffs.push({ type: 'add', line: t })
    }
  }

  const changed = new Set<number>()
  diffs.forEach((d, i) => { if (d.type !== 'same') changed.add(i) })

  const visible = new Set<number>()
  for (const idx of changed) {
    for (let j = Math.max(0, idx - CONTEXT); j <= Math.min(diffs.length - 1, idx + CONTEXT); j++) {
      visible.add(j)
    }
  }

  if (changed.size === 0) {
    return <p className="text-2xs text-text-tertiary pt-1">内容直接复制，无需转换</p>
  }

  const lines: Array<{ type: 'same' | 'del' | 'add' | 'ellipsis'; line: string; idx: number }> = []
  let lastIdx = -1
  for (let i = 0; i < diffs.length; i++) {
    if (!visible.has(i)) continue
    if (lastIdx !== -1 && i - lastIdx > 1) {
      lines.push({ type: 'ellipsis', line: `... ${i - lastIdx - 1} 行未变更 ...`, idx: -1 })
    }
    lines.push({ ...diffs[i], idx: i })
    lastIdx = i
  }

  const styles = {
    same: 'text-text-tertiary',
    del: 'text-red-600 bg-red-50',
    add: 'text-green-600 bg-green-50',
    ellipsis: 'text-text-tertiary italic',
  }

  return (
    <div className="border border-border-default rounded-lg overflow-hidden mt-1">
      <div className="px-3 py-1.5 bg-surface-base border-b border-border-subtle text-2xs text-text-tertiary">
        转换前后对比（仅显示变更行 ±{CONTEXT} 行上下文）
      </div>
      <pre className="text-2xs font-mono leading-relaxed max-h-48 overflow-auto">
        {lines.map((l, i) => (
          <div key={i} className={`px-3 py-0.5 ${styles[l.type]}`}>
            <span className="inline-block w-5 text-right mr-2 opacity-50 select-none">
              {l.type === 'del' ? '-' : l.type === 'add' ? '+' : l.type === 'ellipsis' ? '' : ' '}
            </span>
            {l.line}
          </div>
        ))}
      </pre>
    </div>
  )
}
