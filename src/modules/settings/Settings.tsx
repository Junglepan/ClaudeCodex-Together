import { useEffect, useState } from 'react'
import {
  Palette, Keyboard, Server, Info as InfoIcon, FolderOpen,
  PanelLeftClose, ExternalLink, Copy, Check, RefreshCw, FolderInput,
  Sun, Moon, MonitorSmartphone, Download, ShieldCheck,
} from 'lucide-react'
import { useAppStore } from '@/store'
import type { ThemePref } from '@/store'
import { api } from '@/core/api'
import type { ApiMeta } from '@/core/api'
import { SHORTCUTS } from '@/lib/shortcut-catalog'
import { electronApi, isElectron } from '@/lib/electron-bridge'

const APP_VERSION = '0.1.0'
const REPO_URL = 'https://github.com/Junglepan/ClaudeCodex-Together'

type SectionId = 'project' | 'appearance' | 'shortcuts' | 'backup' | 'environment' | 'about'

const SECTIONS: { id: SectionId; label: string; Icon: typeof Palette }[] = [
  { id: 'project',     label: '项目',     Icon: FolderOpen },
  { id: 'appearance',  label: '外观',     Icon: Palette },
  { id: 'shortcuts',   label: '快捷键',   Icon: Keyboard },
  { id: 'backup',      label: '备份与导出', Icon: ShieldCheck },
  { id: 'environment', label: '运行环境', Icon: Server },
  { id: 'about',       label: '关于',     Icon: InfoIcon },
]

export function Settings() {
  const [active, setActive] = useState<SectionId>('appearance')

  return (
    <div className="flex flex-1 overflow-hidden animate-fade-in">
      {/* Left rail */}
      <aside className="w-44 border-r border-border-default bg-surface-base flex-shrink-0 py-3">
        <div className="px-4 mb-2 text-2xs font-semibold text-text-tertiary uppercase tracking-wider">
          偏好设置
        </div>
        <nav className="px-2 space-y-0.5">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              onClick={() => setActive(s.id)}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                active === s.id
                  ? 'bg-surface-active text-text-primary font-medium'
                  : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary'
              }`}
            >
              <s.Icon size={14} className={active === s.id ? 'text-accent-blue' : 'text-text-tertiary'} />
              {s.label}
            </button>
          ))}
        </nav>
      </aside>

      {/* Body */}
      <div className="flex-1 overflow-auto">
        <div className="max-w-3xl px-8 py-6">
          {active === 'project'     && <ProjectSection />}
          {active === 'appearance'  && <AppearanceSection />}
          {active === 'shortcuts'   && <ShortcutsSection />}
          {active === 'backup'      && <BackupSection />}
          {active === 'environment' && <EnvironmentSection />}
          {active === 'about'       && <AboutSection />}
        </div>
      </div>
    </div>
  )
}

// ── Section: Project ──────────────────────────────────────────────────────────

function ProjectSection() {
  const { projectPath, setProjectPath, pushToast } = useAppStore()

  const switchProject = async () => {
    try {
      const picked = await electronApi.pickDirectory(projectPath)
      if (!picked) return
      setProjectPath(picked)
      pushToast({ kind: 'success', message: `已切换到 ${picked}` })
    } catch (e) {
      pushToast({ kind: 'error', message: e instanceof Error ? e.message : String(e) })
    }
  }

  return (
    <SectionFrame title="项目" subtitle="当前 cc-steward 管理的项目目录，影响所有 *.project 范围的配置文件路径">
      <div className="bg-surface-card border border-border-default rounded-xl p-4 space-y-3">
        <div>
          <div className="text-2xs text-text-tertiary mb-1">当前目录</div>
          <code className="text-xs font-mono text-text-primary break-all">{projectPath ?? '探测中…'}</code>
        </div>
        {isElectron ? (
          <button
            onClick={switchProject}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-accent-blue text-white hover:bg-blue-600 transition-colors"
          >
            <FolderInput size={12} />
            选择目录…
          </button>
        ) : (
          <p className="text-2xs text-text-tertiary italic">
            浏览器模式下无法弹出原生目录选择器；通过 Electron 启动可用此功能。
          </p>
        )}
      </div>
    </SectionFrame>
  )
}

// ── Section: Appearance ───────────────────────────────────────────────────────

function AppearanceSection() {
  const { sidebarCollapsed, setSidebarCollapsed, theme, setTheme } = useAppStore()
  const themeOptions: { value: ThemePref; label: string; Icon: typeof Sun }[] = [
    { value: 'light', label: '浅色', Icon: Sun },
    { value: 'dark',  label: '深色', Icon: Moon },
    { value: 'auto',  label: '跟随系统', Icon: MonitorSmartphone },
  ]
  return (
    <SectionFrame title="外观" subtitle="调整界面布局与显示偏好">
      <SettingRow
        label="主题"
        hint="深色模式使用 macOS 风格的中性灰色"
        control={
          <div className="flex items-center gap-1 p-0.5 bg-surface-base border border-border-default rounded-lg">
            {themeOptions.map((opt) => {
              const active = theme === opt.value
              return (
                <button
                  key={opt.value}
                  onClick={() => setTheme(opt.value)}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-2xs transition-colors ${
                    active ? 'bg-surface-card shadow-sm text-text-primary font-medium' : 'text-text-tertiary hover:text-text-secondary'
                  }`}
                >
                  <opt.Icon size={11} />
                  {opt.label}
                </button>
              )
            })}
          </div>
        }
      />
      <SettingRow
        icon={<PanelLeftClose size={16} className="text-text-tertiary" />}
        label="默认折叠侧栏"
        hint="启动时以图标条形式显示侧栏，节省宽度"
        control={<Toggle checked={sidebarCollapsed} onChange={(v) => setSidebarCollapsed(v)} />}
      />
    </SectionFrame>
  )
}

// ── Section: Shortcuts ────────────────────────────────────────────────────────

function ShortcutsSection() {
  const groups = ['全局', '编辑器', '搜索框'] as const
  return (
    <SectionFrame title="键盘快捷键" subtitle="提高在 cc-steward 中的操作效率">
      {groups.map((scope) => {
        const items = SHORTCUTS.filter((s) => s.scope === scope)
        if (items.length === 0) return null
        return (
          <div key={scope} className="mb-5 last:mb-0">
            <div className="text-2xs font-semibold text-text-tertiary uppercase tracking-wider mb-2">
              {scope}
            </div>
            <div className="bg-surface-card border border-border-default rounded-xl divide-y divide-border-subtle overflow-hidden">
              {items.map((s) => (
                <div key={s.id} className="flex items-center gap-3 px-4 py-2.5">
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-text-primary">{s.label}</div>
                    <div className="text-2xs text-text-tertiary mt-0.5">{s.description}</div>
                  </div>
                  <Kbd>{s.keys}</Kbd>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </SectionFrame>
  )
}

// ── Section: Backup ───────────────────────────────────────────────────────────

function BackupSection() {
  const { projectPath, pushToast } = useAppStore()
  const [downloading, setDownloading] = useState(false)

  const exportZip = async () => {
    setDownloading(true)
    try {
      const url = `/api/backup/export${projectPath ? `?project=${encodeURIComponent(projectPath)}` : ''}`
      const res = await fetch(url)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const blob = await res.blob()
      const a = document.createElement('a')
      const objectUrl = URL.createObjectURL(blob)
      a.href = objectUrl
      a.download = `cc-steward-backup-${new Date().toISOString().slice(0, 10)}.zip`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(objectUrl)
      pushToast({ kind: 'success', message: '已导出配置 ZIP' })
    } catch (e) {
      pushToast({ kind: 'error', message: `导出失败：${e instanceof Error ? e.message : String(e)}` })
    } finally {
      setDownloading(false)
    }
  }

  return (
    <SectionFrame
      title="备份与导出"
      subtitle="文件写入前会自动生成 .bak.<时间戳> 备份；可导出当前所有配置为 ZIP 归档"
    >
      <div className="bg-surface-card border border-border-default rounded-xl p-4 mb-3">
        <div className="flex items-start gap-3">
          <ShieldCheck size={18} className="text-status-active mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <div className="text-sm font-medium text-text-primary">写入安全已启用</div>
            <div className="text-2xs text-text-tertiary mt-0.5 leading-relaxed">
              所有写入限制在 <code className="font-mono">~/.claude/</code> · <code className="font-mono">~/.codex/</code> · <code className="font-mono">~/.agents/</code> 与当前项目目录内；
              覆盖前自动备份到同目录 <code className="font-mono">.bak.&lt;时间戳&gt;</code>。
            </div>
          </div>
        </div>
      </div>

      <div className="bg-surface-card border border-border-default rounded-xl p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="text-sm font-medium text-text-primary">导出全部配置</div>
            <div className="text-2xs text-text-tertiary mt-0.5 leading-relaxed">
              将 Claude / Codex / .agents 当前已存在的全部文件打包成 ZIP，含 MANIFEST 索引。
            </div>
          </div>
          <button
            onClick={exportZip}
            disabled={downloading}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-accent-blue text-white hover:bg-blue-600 transition-colors disabled:opacity-50"
          >
            <Download size={12} className={downloading ? 'animate-pulse' : ''} />
            {downloading ? '导出中…' : '导出 ZIP'}
          </button>
        </div>
      </div>
    </SectionFrame>
  )
}

// ── Section: Environment ──────────────────────────────────────────────────────

function EnvironmentSection() {
  const { projectPath, platform } = useAppStore()
  const [meta, setMeta]       = useState<ApiMeta | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)

  const load = () => {
    setLoading(true); setError(null)
    api.meta()
      .then(setMeta)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false))
  }
  useEffect(load, [])

  return (
    <SectionFrame
      title="运行环境"
      subtitle="当前后端探测到的本机信息"
      action={
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border border-border-default text-text-secondary hover:bg-surface-hover transition-colors disabled:opacity-50"
        >
          <RefreshCw size={11} className={loading ? 'animate-spin' : ''} />
          重新探测
        </button>
      }
    >
      {error ? (
        <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">{error}</div>
      ) : (
        <div className="bg-surface-card border border-border-default rounded-xl divide-y divide-border-subtle overflow-hidden">
          <InfoRow label="项目路径"    value={meta?.project_path ?? projectPath ?? '—'} mono copyable />
          <InfoRow label="HOME"        value={meta?.home_path ?? '—'}                   mono copyable />
          <InfoRow label="平台"         value={meta?.platform ?? platform ?? '—'} />
          <InfoRow label="主机名"       value={meta?.hostname ?? '—'}                   mono />
          <InfoRow label="Python 版本"  value={meta?.python_version ?? '—'}             mono />
          <InfoRow label="后端地址"     value="http://127.0.0.1:8765" mono copyable />
          <InfoRow label="前端地址"     value="http://localhost:5174" mono copyable />
        </div>
      )}
    </SectionFrame>
  )
}

// ── Section: About ────────────────────────────────────────────────────────────

function AboutSection() {
  return (
    <SectionFrame title="关于" subtitle="cc-steward · 本地 Claude Code / Codex 配置管家">
      <div className="bg-surface-card border border-border-default rounded-xl p-5 space-y-4">
        <div className="flex items-baseline gap-3">
          <span className="text-base font-semibold text-text-primary">cc-steward</span>
          <span className="text-2xs px-1.5 py-0.5 rounded bg-accent-blue/10 text-accent-blue font-mono">
            v{APP_VERSION}
          </span>
        </div>
        <p className="text-sm text-text-secondary leading-relaxed">
          一个本地桌面工具，帮助同时使用 Claude Code 和 Codex CLI 的开发者可视化、管理、迁移工作习惯。
          所有数据来源于本机文件系统，不连接任何远程服务。
        </p>
        <div className="flex items-center gap-2 pt-2">
          <a
            href={REPO_URL}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-border-default text-text-secondary hover:bg-surface-hover transition-colors"
          >
            <ExternalLink size={12} />
            GitHub
          </a>
        </div>
      </div>
    </SectionFrame>
  )
}

// ── Shared building blocks ────────────────────────────────────────────────────

function SectionFrame({
  title, subtitle, action, children,
}: {
  title: string
  subtitle?: string
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className="animate-fade-in">
      <div className="flex items-start justify-between mb-5">
        <div>
          <h2 className="text-lg font-semibold text-text-primary">{title}</h2>
          {subtitle && <p className="text-sm text-text-secondary mt-0.5">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

function SettingRow({
  icon, label, hint, control,
}: {
  icon?: React.ReactNode
  label: string
  hint?: string
  control: React.ReactNode
}) {
  return (
    <div className="bg-surface-card border border-border-default rounded-xl px-4 py-3 mb-2 flex items-start gap-3 last:mb-0">
      {icon && <div className="mt-0.5 flex-shrink-0">{icon}</div>}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-text-primary">{label}</div>
        {hint && <div className="text-2xs text-text-tertiary mt-0.5">{hint}</div>}
      </div>
      <div className="flex-shrink-0">{control}</div>
    </div>
  )
}

function InfoRow({
  label, value, mono, copyable,
}: {
  label: string
  value: string
  mono?: boolean
  copyable?: boolean
}) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard?.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-hover transition-colors">
      <span className="text-xs text-text-tertiary w-32 flex-shrink-0">{label}</span>
      <span className={`flex-1 text-xs ${mono ? 'font-mono' : ''} text-text-primary truncate`}>{value}</span>
      {copyable && (
        <button
          onClick={copy}
          title="复制"
          className="text-text-tertiary hover:text-text-secondary transition-colors flex-shrink-0"
        >
          {copied ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
        </button>
      )}
    </div>
  )
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative w-9 h-5 rounded-full transition-colors ${
        checked ? 'bg-accent-blue' : 'bg-border-default'
      }`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${
          checked ? 'translate-x-4' : ''
        }`}
      />
    </button>
  )
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="text-2xs font-mono px-2 py-1 bg-surface-base border border-border-default rounded text-text-secondary tracking-wide">
      {children}
    </kbd>
  )
}
