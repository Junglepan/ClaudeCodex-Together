import { ArrowDown, GitMerge, Layers, BookOpen, Wrench } from 'lucide-react'

interface LayerItem {
  label: string
  sublabel: string
  path: string
  priority: 'highest' | 'high' | 'medium' | 'low' | 'base'
  note?: string
}

const SETTINGS_LAYERS: LayerItem[] = [
  {
    label: '命令行参数',
    sublabel: '--config, --model',
    path: '运行时传入',
    priority: 'highest',
    note: '会话级覆盖，仅当次有效',
  },
  {
    label: '项目配置',
    sublabel: '.claude/settings.json',
    path: '{project}/.claude/settings.json',
    priority: 'high',
    note: '与全局配置深度合并，项目字段优先',
  },
  {
    label: '全局用户配置',
    sublabel: 'settings.json',
    path: '~/.claude/settings.json',
    priority: 'medium',
    note: 'hooks、permissions、model、env 等全局默认',
  },
  {
    label: '内置默认值',
    sublabel: 'Claude Code 硬编码',
    path: '二进制内部',
    priority: 'base',
    note: '最低优先级，被所有层覆盖',
  },
]

const CLAUDE_MD_LAYERS = [
  { label: '全局指令', path: '~/.claude/CLAUDE.md', desc: '每个会话都注入，个人习惯偏好' },
  { label: '项目根目录', path: './CLAUDE.md', desc: '项目上下文、规范、团队约定' },
  { label: '子目录指令', path: './<subdir>/CLAUDE.md', desc: '目录级特定规则（可选，嵌套加载）' },
]

const SKILL_LAYERS = [
  { label: '全局 Skills', path: '~/.claude/skills/', desc: '所有项目可用的斜杠命令', color: 'bg-purple-50 border-purple-200 text-purple-700' },
  { label: '项目 Agents', path: '.claude/agents/', desc: '项目专属子 Agent，可覆盖同名全局', color: 'bg-blue-50 border-blue-200 text-blue-700' },
]

const PRIORITY_STYLES: Record<LayerItem['priority'], { bar: string; badge: string; label: string }> = {
  highest: { bar: 'bg-accent-red/80',    badge: 'bg-red-100 text-red-700',     label: '最高' },
  high:    { bar: 'bg-accent-orange/80', badge: 'bg-orange-100 text-orange-700', label: '高' },
  medium:  { bar: 'bg-accent-blue/70',   badge: 'bg-blue-100 text-blue-700',    label: '中' },
  low:     { bar: 'bg-gray-300',         badge: 'bg-gray-100 text-gray-500',    label: '低' },
  base:    { bar: 'bg-gray-200',         badge: 'bg-gray-100 text-gray-400',    label: '基准' },
}

export function ClaudeRelTree() {
  return (
    <div className="space-y-5">

      {/* Settings merge order */}
      <section>
        <SectionHeader icon={<GitMerge size={14} />} title="配置合并优先级" subtitle="settings.json 多层合并 — 箭头方向为覆盖方向（下层覆盖上层）" />
        <div className="space-y-1.5">
          {SETTINGS_LAYERS.map((layer, i) => {
            const style = PRIORITY_STYLES[layer.priority]
            return (
              <div key={layer.label}>
                <div className="flex items-stretch gap-3 rounded-xl border border-border-default bg-white overflow-hidden">
                  {/* Priority bar */}
                  <div className={`w-1 flex-shrink-0 ${style.bar}`} />
                  <div className="flex-1 py-2.5 pr-3">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs font-medium text-text-primary">{layer.label}</span>
                      <span className={`text-2xs px-1.5 py-0.5 rounded font-medium ${style.badge}`}>{style.label}优先</span>
                    </div>
                    <div className="flex items-center gap-2 text-2xs">
                      <code className="text-text-tertiary font-mono bg-surface-base px-1.5 py-0.5 rounded">{layer.path}</code>
                      {layer.note && <span className="text-text-tertiary">— {layer.note}</span>}
                    </div>
                  </div>
                </div>
                {i < SETTINGS_LAYERS.length - 1 && (
                  <div className="flex justify-start pl-5 my-0.5">
                    <ArrowDown size={12} className="text-border-default" />
                  </div>
                )}
              </div>
            )
          })}
        </div>
        <div className="mt-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-2xs text-amber-800">
          合并策略：同一字段时，高优先级的值覆盖低优先级；<code className="font-mono">hooks</code>、<code className="font-mono">permissions</code> 数组按层合并追加。
        </div>
      </section>

      {/* CLAUDE.md loading */}
      <section>
        <SectionHeader icon={<BookOpen size={14} />} title="CLAUDE.md 加载顺序" subtitle="所有层均被加载并拼接注入上下文，不互相覆盖" />
        <div className="border border-border-default rounded-xl overflow-hidden divide-y divide-border-subtle">
          {CLAUDE_MD_LAYERS.map((layer, i) => (
            <div key={layer.path} className="flex items-center gap-3 px-3 py-2.5 bg-white hover:bg-surface-hover transition-colors">
              <div className="w-5 h-5 rounded-full bg-accent-blue/10 border border-accent-blue/20 flex items-center justify-center flex-shrink-0">
                <span className="text-2xs font-bold text-accent-blue">{i + 1}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium text-text-primary">{layer.label}</div>
                <div className="text-2xs text-text-tertiary">{layer.desc}</div>
              </div>
              <code className="text-2xs font-mono text-text-secondary bg-surface-base px-2 py-0.5 rounded">{layer.path}</code>
            </div>
          ))}
        </div>
        <p className="mt-2 text-2xs text-text-tertiary px-1">
          子目录 CLAUDE.md 在 Claude Code 进入对应目录时自动加载，不需要手动指定。
        </p>
      </section>

      {/* Skills / Agents scope */}
      <section>
        <SectionHeader icon={<Wrench size={14} />} title="Skills & Agents 作用域" subtitle="项目级同名定义会覆盖全局同名定义" />
        <div className="grid grid-cols-2 gap-3">
          {SKILL_LAYERS.map((layer) => (
            <div key={layer.label} className={`border rounded-xl p-3 ${layer.color}`}>
              <div className="text-xs font-semibold mb-1">{layer.label}</div>
              <code className="text-2xs font-mono block mb-1.5 opacity-80">{layer.path}</code>
              <p className="text-2xs leading-relaxed">{layer.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Hooks */}
      <section>
        <SectionHeader icon={<Layers size={14} />} title="Hooks 触发时机" subtitle="在 settings.json 中 hooks 字段定义，全局或项目均可" />
        <div className="grid grid-cols-3 gap-2">
          {['SessionStart', 'Stop', 'PreToolUse', 'PostToolUse', 'Notification'].map((evt) => (
            <div key={evt} className="bg-surface-base border border-border-default rounded-lg px-2.5 py-2 text-center">
              <code className="text-2xs font-mono text-text-secondary">{evt}</code>
            </div>
          ))}
        </div>
        <p className="mt-2 text-2xs text-text-tertiary px-1">
          Stop hook 可通过退出码 2 阻止会话关闭，PostToolUse 可拦截工具调用结果。
        </p>
      </section>

    </div>
  )
}

function SectionHeader({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle: string }) {
  return (
    <div className="flex items-start gap-2 mb-3">
      <div className="w-6 h-6 rounded-lg bg-accent-blue/10 flex items-center justify-center text-accent-blue flex-shrink-0 mt-0.5">
        {icon}
      </div>
      <div>
        <div className="text-sm font-semibold text-text-primary">{title}</div>
        <div className="text-2xs text-text-tertiary mt-0.5">{subtitle}</div>
      </div>
    </div>
  )
}
