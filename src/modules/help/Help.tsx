import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, ChevronRight } from 'lucide-react'
import { agentRegistry } from '@/core/agent-registry'
import { useAppStore } from '@/store'
import { SHORTCUTS } from '@/lib/shortcut-catalog'

const HOOK_EVENT_MAP = [
  { claude: 'SessionStart',  codex: null,             note: '无 Codex 等价物，Codex 没有 session 启动钩子' },
  { claude: 'Stop',          codex: null,             note: '无 Codex 等价物，建议将行为描述写入 AGENTS.md' },
  { claude: 'PreToolUse',    codex: 'pre_tool_call',  note: '语义相近，但阻断行为细节可能不同' },
  { claude: 'PostToolUse',   codex: 'post_tool_call', note: '语义相近' },
  { claude: 'Notification',  codex: null,             note: '无 Codex 等价物，无法迁移' },
]

const SYNC_SCOPE = [
  { label: '✅ 迁移', tone: 'green', items: ['CLAUDE.md → AGENTS.md（项目指令）', 'skills/*/SKILL.md → .agents/skills/<name>.md', '.claude/agents/*.md → .codex/agents/<name>.md'] },
  { label: '❌ 不迁移', tone: 'gray', items: ['hooks（基础设施层，事件系统差异大）', 'MCP servers（工具配置，非工作习惯）', '模型选择、权限设置（工具专有）'] },
]

const SECTIONS: { id: string; label: string }[] = [
  { id: 'overview',     label: '工具定位' },
  { id: 'environment',  label: '当前环境' },
  { id: 'layers',       label: '配置层次' },
  { id: 'hooks',        label: 'Hook 事件对照' },
  { id: 'sync',         label: '同步范围' },
  { id: 'agents',       label: '已注册的 Agent' },
  { id: 'shortcuts',    label: '键盘快捷键' },
  { id: 'safety',       label: '写入安全原则' },
]

export function Help() {
  const [active, setActive] = useState<string>('overview')
  const containerRef = useRef<HTMLDivElement>(null)

  // Observe section visibility for active TOC item
  useEffect(() => {
    const root = containerRef.current
    if (!root) return
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => (a.target as HTMLElement).offsetTop - (b.target as HTMLElement).offsetTop)
        if (visible[0]) setActive(visible[0].target.id)
      },
      { root, rootMargin: '-10% 0px -75% 0px', threshold: 0 },
    )
    SECTIONS.forEach((s) => {
      const el = root.querySelector(`#${s.id}`)
      if (el) observer.observe(el)
    })
    return () => observer.disconnect()
  }, [])

  const scrollTo = (id: string) => {
    const root = containerRef.current
    if (!root) return
    const el = root.querySelector(`#${id}`) as HTMLElement | null
    if (el) {
      root.scrollTo({ top: el.offsetTop - 16, behavior: 'smooth' })
      setActive(id)
    }
  }

  return (
    <div className="flex flex-1 overflow-hidden animate-fade-in">
      {/* TOC rail */}
      <aside className="w-44 border-r border-border-default bg-surface-base flex-shrink-0 py-3 hidden md:block">
        <div className="px-4 mb-2 text-2xs font-semibold text-text-tertiary uppercase tracking-wider">
          目录
        </div>
        <nav className="px-2 space-y-0.5">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              onClick={() => scrollTo(s.id)}
              className={`w-full flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-left transition-colors ${
                active === s.id
                  ? 'bg-surface-active text-text-primary font-medium'
                  : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary'
              }`}
            >
              <span className={`w-1 h-3 rounded-full transition-colors ${active === s.id ? 'bg-accent-blue' : 'bg-transparent'}`} />
              <span className="truncate">{s.label}</span>
            </button>
          ))}
        </nav>
      </aside>

      {/* Content */}
      <div ref={containerRef} className="flex-1 overflow-auto">
        <div className="max-w-3xl px-8 py-6">
          <div className="mb-6">
            <h1 className="text-xl font-semibold text-text-primary">说明</h1>
            <p className="mt-1 text-sm text-text-secondary">
              工具原理、配置层次、同步策略与操作参考
            </p>
          </div>

          <Section id="overview" title="工具定位">
            <div className="bg-surface-card border border-border-default rounded-xl p-4 space-y-2">
              <p className="text-sm text-text-secondary leading-relaxed">
                CCT 是一个<strong className="text-text-primary">本地配置管理工具</strong>，帮助你在 Claude Code 和 Codex 之间保持一致的工作方式。
                所有数据来源于本地文件，不连接任何远程服务。
              </p>
              <p className="text-sm text-text-secondary leading-relaxed">
                核心理念：把你在 Claude 里积累的<strong className="text-text-primary">工作习惯</strong>（指令、技能、角色）以合适的格式带到 Codex，
                而不是强制同步工具专有的基础设施配置。
              </p>
            </div>
          </Section>

          <Section id="environment" title="当前环境">
            <CurrentEnvironment />
          </Section>

          <Section id="layers" title="配置层次">
            <div className="space-y-2">
              {[
                { label: '工作习惯层', badge: '同步目标', tone: 'blue', items: ['项目指令 (CLAUDE.md / AGENTS.md)', '技能定义 (skills/)', '自定义 Agent (.claude/agents/)'] },
                { label: '基础设施层', badge: '不同步', tone: 'gray', items: ['Hooks 事件系统', 'MCP Server 配置', '模型选择 / 权限设置'] },
              ].map((layer) => (
                <div key={layer.label} className="bg-surface-card border border-border-default rounded-xl p-4 hover:border-border-default/80 transition-colors">
                  <div className="flex items-center gap-2 mb-2.5">
                    <span className="text-sm font-medium text-text-primary">{layer.label}</span>
                    <span className={`text-2xs px-1.5 py-0.5 rounded font-medium ${
                      layer.tone === 'blue' ? 'bg-accent-blue/10 text-accent-blue' : 'bg-gray-100 text-gray-500'
                    }`}>{layer.badge}</span>
                  </div>
                  <ul className="space-y-1">
                    {layer.items.map((item) => (
                      <li key={item} className="text-xs text-text-secondary flex items-center gap-2">
                        <span className="w-1 h-1 rounded-full bg-text-tertiary flex-shrink-0" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </Section>

          <Section id="hooks" title="Hook 事件对照">
            <div className="bg-surface-card border border-border-default rounded-xl overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-surface-base/60 border-b border-border-subtle">
                    <th className="text-left px-3 py-2 font-medium text-text-tertiary">Claude 事件</th>
                    <th className="text-left px-3 py-2 font-medium text-text-tertiary">Codex 等价</th>
                    <th className="text-left px-3 py-2 font-medium text-text-tertiary">说明</th>
                  </tr>
                </thead>
                <tbody>
                  {HOOK_EVENT_MAP.map((row) => (
                    <tr key={row.claude} className="border-b border-border-subtle last:border-0 hover:bg-surface-hover/50 transition-colors">
                      <td className="px-3 py-2 font-mono text-text-primary">{row.claude}</td>
                      <td className="px-3 py-2">
                        {row.codex
                          ? <span className="font-mono text-green-700">{row.codex}</span>
                          : <span className="text-text-tertiary">—</span>
                        }
                      </td>
                      <td className="px-3 py-2 text-text-secondary">{row.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          <Section id="sync" title="同步范围">
            <div className="grid grid-cols-2 gap-3">
              {SYNC_SCOPE.map((group) => (
                <div key={group.label} className="bg-surface-card border border-border-default rounded-xl p-4">
                  <div className="text-xs font-medium text-text-primary mb-2">{group.label}</div>
                  <ul className="space-y-1">
                    {group.items.map((item) => (
                      <li key={item} className="text-2xs text-text-secondary leading-relaxed flex items-start gap-1.5">
                        <span className={`w-1 h-1 rounded-full flex-shrink-0 mt-1.5 ${group.tone === 'green' ? 'bg-status-active' : 'bg-text-tertiary'}`} />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </Section>

          <Section id="agents" title="已注册的 Agent">
            <RegisteredAgents />
          </Section>

          <Section id="shortcuts" title="键盘快捷键">
            <div className="bg-surface-card border border-border-default rounded-xl divide-y divide-border-subtle overflow-hidden">
              {SHORTCUTS.map((s) => (
                <div key={s.id} className="flex items-center gap-3 px-4 py-2.5">
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-text-primary">{s.label}</div>
                    <div className="text-2xs text-text-tertiary mt-0.5">{s.description}</div>
                  </div>
                  <span className="text-2xs text-text-tertiary uppercase font-medium">{s.scope}</span>
                  <kbd className="text-2xs font-mono px-2 py-1 bg-surface-base border border-border-default rounded text-text-secondary tracking-wide">
                    {s.keys}
                  </kbd>
                </div>
              ))}
            </div>
          </Section>

          <Section id="safety" title="写入安全原则">
            <div className="bg-surface-card border border-border-default rounded-xl p-4">
              <ul className="space-y-2">
                {[
                  '绝不修改 Claude 源文件（.claude/、~/.claude/、.claude.json）',
                  '目标文件已存在时默认跳过，需 --replace 才覆盖',
                  '保留 Codex config.toml 中已有的无关配置项',
                  'dry_run 模式只返回计划，不写任何文件',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2 text-xs text-text-secondary leading-relaxed">
                    <span className="text-status-active mt-0.5 flex-shrink-0">✓</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </Section>
        </div>
      </div>
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="mb-8 scroll-mt-4">
      <h2 className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-2">
        <span className="w-1 h-4 bg-accent-blue rounded-full" />
        {title}
      </h2>
      {children}
    </section>
  )
}

function CurrentEnvironment() {
  const { projectPath, platform } = useAppStore()
  return (
    <div className="grid grid-cols-2 gap-2">
      <EnvCard label="当前项目" value={projectPath ?? '探测中…'} mono />
      <EnvCard label="平台"      value={platform ?? '探测中…'} />
    </div>
  )
}

function EnvCard({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="bg-surface-card border border-border-default rounded-xl p-3">
      <div className="text-2xs text-text-tertiary mb-1">{label}</div>
      <div className={`text-xs ${mono ? 'font-mono' : ''} text-text-primary truncate`}>{value}</div>
    </div>
  )
}

function RegisteredAgents() {
  const navigate = useNavigate()
  const agents = agentRegistry.getAll()
  return (
    <div className="space-y-2">
      {agents.map((agent) => {
        const path = `/config/${agent.id}`
        return (
          <button
            key={agent.id}
            onClick={() => navigate(path)}
            className="w-full bg-surface-card border border-border-default rounded-xl p-4 hover:border-accent-blue/40 hover:shadow-sm transition-all text-left flex items-center gap-3 group"
          >
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: `${agent.color}18` }}
            >
              <agent.Icon size={16} color={agent.color} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-text-primary">{agent.name}</div>
              <div className="text-2xs text-text-tertiary mt-0.5 font-mono">{agent.globalDir}</div>
              <div className="text-2xs text-text-tertiary mt-1">
                {agent.configFiles.length} 个配置文件 · Hook：{agent.hookEvents.length === 0 ? '无' : agent.hookEvents.join(', ')}
              </div>
            </div>
            <ArrowRight size={14} className="text-text-tertiary group-hover:text-accent-blue group-hover:translate-x-0.5 transition-all flex-shrink-0" />
          </button>
        )
      })}
      <p className="text-2xs text-text-tertiary mt-2 flex items-center gap-1">
        <ChevronRight size={10} /> 点击卡片直接跳转到对应 Agent 配置页
      </p>
    </div>
  )
}
