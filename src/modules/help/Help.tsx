import { agentRegistry } from '@/core/agent-registry'

const HOOK_EVENT_MAP = [
  { claude: 'SessionStart',  codex: null,             note: '无 Codex 等价物，Codex 没有 session 启动钩子' },
  { claude: 'Stop',          codex: null,             note: '无 Codex 等价物，建议将行为描述写入 AGENTS.md' },
  { claude: 'PreToolUse',    codex: 'pre_tool_call',  note: '语义相近，但阻断行为细节可能不同' },
  { claude: 'PostToolUse',   codex: 'post_tool_call', note: '语义相近' },
  { claude: 'Notification',  codex: null,             note: '无 Codex 等价物，无法迁移' },
]

const SYNC_SCOPE = [
  { label: '✅ 迁移', items: ['CLAUDE.md → AGENTS.md（项目指令）', 'skills/*/SKILL.md → .agents/skills/<name>.md', '.claude/agents/*.md → .codex/agents/<name>.md'] },
  { label: '❌ 不迁移', items: ['hooks（基础设施层，事件系统差异大）', 'MCP servers（工具配置，非工作习惯）', '模型选择、权限设置（工具专有）'] },
]

export function Help() {
  const agents = agentRegistry.getAll()

  return (
    <div className="flex-1 overflow-auto p-6 max-w-3xl">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-text-primary">说明</h1>
        <p className="mt-1 text-sm text-text-secondary">
          工具原理、配置层次和同步策略说明
        </p>
      </div>

      {/* Tool overview */}
      <Section title="工具定位">
        <p className="text-sm text-text-secondary leading-relaxed">
          CCT 是一个<strong className="text-text-primary">本地配置管理工具</strong>，帮助你在 Claude Code 和 Codex 之间保持一致的工作方式。
          所有数据来源于本地文件，不连接任何远程服务。
        </p>
        <p className="text-sm text-text-secondary leading-relaxed mt-2">
          核心理念：把你在 Claude 里积累的<strong className="text-text-primary">工作习惯</strong>（指令、技能、角色）以合适的格式带到 Codex，
          而不是强制同步工具专有的基础设施配置。
        </p>
      </Section>

      {/* Config layers */}
      <Section title="配置层次">
        <div className="space-y-2">
          {[
            { label: '工作习惯层', badge: '同步目标', color: 'blue', items: ['项目指令 (CLAUDE.md / AGENTS.md)', '技能定义 (skills/)', '自定义 Agent (.claude/agents/)'] },
            { label: '基础设施层', badge: '不同步', color: 'gray', items: ['Hooks 事件系统', 'MCP Server 配置', '模型选择 / 权限设置'] },
          ].map((layer) => (
            <div key={layer.label} className="border border-border-default rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-medium text-text-primary">{layer.label}</span>
                <span className={`text-2xs px-1.5 py-0.5 rounded ${
                  layer.color === 'blue' ? 'bg-accent-blue/10 text-accent-blue' : 'bg-gray-100 text-gray-500'
                }`}>{layer.badge}</span>
              </div>
              <ul className="space-y-0.5">
                {layer.items.map((item) => (
                  <li key={item} className="text-xs text-text-secondary flex items-center gap-1.5">
                    <span className="w-1 h-1 rounded-full bg-text-tertiary flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Section>

      {/* Hook event map */}
      <Section title="Hook 事件对照">
        <table className="w-full text-xs border border-border-default rounded-lg overflow-hidden">
          <thead>
            <tr className="bg-surface-base border-b border-border-subtle">
              <th className="text-left px-3 py-2 font-medium text-text-tertiary">Claude 事件</th>
              <th className="text-left px-3 py-2 font-medium text-text-tertiary">Codex 等价</th>
              <th className="text-left px-3 py-2 font-medium text-text-tertiary">说明</th>
            </tr>
          </thead>
          <tbody>
            {HOOK_EVENT_MAP.map((row) => (
              <tr key={row.claude} className="border-b border-border-subtle last:border-0">
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
      </Section>

      {/* Sync scope */}
      <Section title="同步范围">
        <div className="grid grid-cols-2 gap-3">
          {SYNC_SCOPE.map((group) => (
            <div key={group.label} className="border border-border-default rounded-lg p-3">
              <div className="text-xs font-medium text-text-primary mb-2">{group.label}</div>
              <ul className="space-y-1">
                {group.items.map((item) => (
                  <li key={item} className="text-2xs text-text-secondary leading-relaxed">{item}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Section>

      {/* Agent config files reference */}
      <Section title="已注册的 Agent">
        <div className="space-y-3">
          {agents.map((agent) => (
            <div key={agent.id} className="border border-border-default rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                <agent.Icon size={13} color={agent.color} />
                <span className="text-xs font-medium text-text-primary">{agent.name}</span>
                <span className="text-2xs text-text-tertiary font-mono">{agent.globalDir}</span>
              </div>
              <div className="text-2xs text-text-tertiary">
                {agent.configFiles.length} 个配置文件定义 · Hook 事件：{agent.hookEvents.join(', ')}
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* Write safety */}
      <Section title="写入安全原则">
        <ul className="space-y-1.5">
          {[
            '绝不修改 Claude 源文件（.claude/、~/.claude/、.claude.json）',
            '目标文件已存在时默认跳过，需 --replace 才覆盖',
            '保留 Codex config.toml 中已有的无关配置项',
            'dry_run 模式只返回计划，不写任何文件',
          ].map((item) => (
            <li key={item} className="flex items-start gap-2 text-xs text-text-secondary">
              <span className="text-status-active mt-0.5">✓</span>
              {item}
            </li>
          ))}
        </ul>
      </Section>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <h2 className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-2">
        <span className="w-1 h-4 bg-accent-blue rounded-full" />
        {title}
      </h2>
      {children}
    </div>
  )
}
