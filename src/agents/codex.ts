import { Cpu } from 'lucide-react'
import type { AgentDefinition } from './types'

export const codexAgent: AgentDefinition = {
  id: 'codex',
  name: 'OpenAI Codex CLI',
  shortName: 'Codex',
  description: 'OpenAI Codex CLI',
  color: '#059669',
  Icon: Cpu,
  globalDir: '~/.codex',
  hookEvents: ['pre_tool_call', 'post_tool_call'],
  configFiles: [
    // ── Global layer ────────────────────────────────────────────────────────
    {
      key: 'global_config',
      label: 'config.toml',
      pathTemplate: '{home}/.codex/config.toml',
      scope: 'global',
      kind: 'file',
      format: 'toml',
      purpose: 'Codex CLI 的主配置文件。控制模型选择、沙箱行为、MCP 服务器、对话风格和审批策略。',
      details:
        '主要字段：\n• model — 默认模型（如 o4-mini、gpt-4.1）\n• personality — 对话风格（如 friendly）\n• approval — suggest | auto-edit | full-auto\n• sandbox — network-disabled 等沙箱选项\n• [mcp_servers] — MCP 服务器定义\n• [features] — 功能开关（如 codex_hooks = true）\n\n' +
        'MCP server 格式：\n[mcp_servers.<name>]\ncommand = "npx"\nargs    = ["-y", "@mcp/server-github"]\n\n' +
        '[projects] 字段：\n• [projects."/path/to/project"] 段定义每个项目的 trust_level\n• trust_level 直接影响 Codex 在该项目下的行为权限（如 full-auto 允许无需审批执行）',
      counterpartAgent: 'claude',
      counterpartKey: 'global_settings',
    },
    {
      key: 'global_instructions',
      label: 'AGENTS.md',
      pathTemplate: '{home}/.codex/AGENTS.md',
      scope: 'global',
      kind: 'file',
      format: 'markdown',
      purpose: '全局自然语言指令，在每次 Codex 会话启动时自动注入。优先级低于项目级 AGENTS.md。',
      details:
        '与 ~/.claude/CLAUDE.md 的 Codex 等价物。\n避免包含 Claude 专属语法（/compact、/clear 等斜杠命令引用）。\n\n加载顺序（低 → 高）：\n1. ~/.codex/AGENTS.md（此文件，全局）\n2. {project}/AGENTS.md（项目根）\n3. 子目录 AGENTS.md（嵌套加载）',
      counterpartAgent: 'claude',
      counterpartKey: 'global_instructions',
    },
    {
      key: 'global_hooks',
      label: 'hooks.json',
      pathTemplate: '{home}/.codex/hooks.json',
      scope: 'global',
      kind: 'file',
      format: 'json',
      purpose: '全局 Codex 钩子配置。需要在 config.toml 中启用 [features].codex_hooks = true 才生效。',
      details:
        '格式：\n{ "<event>": [{ "command": "...", "matcher": "..." }] }\n\n支持的事件：\n• pre_tool_call  — 工具调用前（对应 Claude 的 PreToolUse）\n• post_tool_call — 工具调用后（对应 Claude 的 PostToolUse）\n\nClaude 有而 Codex 没有的事件：\n• SessionStart、Stop、Notification（无法迁移）\n\n启用方式：\n[features]\ncodex_hooks = true',
      counterpartAgent: 'claude',
      counterpartKey: 'global_settings',
    },
    {
      key: 'global_agents',
      label: '.codex/agents/',
      pathTemplate: '{home}/.codex/agents/',
      scope: 'global',
      kind: 'dir',
      format: 'dir',
      purpose: '全局自定义 Agent 定义，供所有项目使用。',
      details:
        '文件格式（带 YAML frontmatter 的 Markdown）：\n---\nname: agent-name\ndescription: 使用场景描述\n---\n<Agent 指令>\n\nCodex 根据任务上下文匹配 description 自动选择 Agent。\n全局 Agent 优先级低于项目级同名 Agent。',
      counterpartAgent: 'claude',
      counterpartKey: 'global_agents',
    },
    {
      key: 'global_skills',
      label: '.codex/skills/',
      pathTemplate: '{home}/.codex/skills/',
      scope: 'global',
      kind: 'dir',
      format: 'dir',
      purpose: 'Codex 原生技能目录（非迁移路径）。Codex 原生读取此路径，存放全局可用的 Prompt 模板技能。',
      details:
        '此路径是 Codex 自身的 skills 存储位置（区别于迁移中转路径 ~/.agents/skills/）。\n\n文件格式（带 YAML frontmatter 的 Markdown）：\n---\nname: skill-name\ndescription: 使用场景\n---\n<技能提示>\n\n' +
        '从 Claude 迁移：~/.claude/skills/<name>/SKILL.md → ~/.codex/skills/<name>.md',
      counterpartAgent: 'claude',
      counterpartKey: 'global_skills',
    },
    {
      key: 'global_memories',
      label: 'memories/',
      pathTemplate: '{home}/.codex/memories/',
      scope: 'global',
      kind: 'dir',
      format: 'dir',
      purpose: 'Codex 记忆系统目录（Codex 独有功能，Claude 无对应机制）。只读展示。',
      details:
        '需在 config.toml 中启用：\n[features]\nmemories = true\n\n目录内包含：\n• MEMORY.md — 结构化记忆条目\n• raw_memories.md — 原始记忆日志\n• memory_summary.md — 压缩摘要\n\n未启用时目录不存在，展示"此功能未开启"。不在同步范围内（Claude 无对应机制）。',
    },
    {
      key: 'global_auth',
      label: 'auth.json',
      pathTemplate: '{home}/.codex/auth.json',
      scope: 'global',
      kind: 'file',
      format: 'json',
      purpose: '存储 Codex 认证信息（API key、token 等）。由 Codex 自动管理，不建议手动编辑。只读展示。',
      details:
        '等价于 Claude 的 ~/.claude.json，存储 API key 和认证 token。\n\n注意：由 Codex 自动管理，手动编辑可能破坏认证状态。不在同步范围内。',
    },
    // ── Project layer ───────────────────────────────────────────────────────
    {
      key: 'project_config',
      label: '.codex/config.toml',
      pathTemplate: '{project}/.codex/config.toml',
      scope: 'project',
      kind: 'file',
      format: 'toml',
      purpose: '项目级 Codex 配置，与全局 config.toml 结构相同，但仅对当前项目生效。',
      details:
        '常见项目级用途：\n• model — 覆盖全局模型设置\n• approval — 调整审批宽严程度\n• [mcp_servers] — 项目专用 MCP 服务器\n\n与全局配置合并时，项目配置优先。不认识的字段会被保留而非删除。',
      counterpartAgent: 'claude',
      counterpartKey: 'project_settings',
    },
    {
      key: 'project_instructions',
      label: 'AGENTS.md',
      pathTemplate: '{project}/AGENTS.md',
      scope: 'project',
      kind: 'file',
      format: 'markdown',
      purpose: '项目级 Codex 指令文件，等价于 Claude 的 CLAUDE.md。会话启动时自动注入。',
      details:
        '优先级高于全局 AGENTS.md。\n支持嵌套子目录 AGENTS.md（与 CLAUDE.md 相同）。\n\n从 CLAUDE.md 迁移时需要：\n• 移除 Claude 斜杠命令引用（/compact、/clear 等）\n• 替换 Claude 工具名引用为自然语言描述\n• 保留所有项目约定、编码规范和使用偏好',
      counterpartAgent: 'claude',
      counterpartKey: 'project_instructions',
      syncStrategy: '迁移目标：CLAUDE.md 内容适配后写入此文件',
    },
    {
      key: 'project_hooks',
      label: '.codex/hooks.json',
      pathTemplate: '{project}/.codex/hooks.json',
      scope: 'project',
      kind: 'file',
      format: 'json',
      purpose: '项目级 Codex 钩子配置，与全局 hooks.json 结构相同，仅对当前项目生效。',
      details:
        '需在 .codex/config.toml 中启用：\n[features]\ncodex_hooks = true\n\n支持事件：pre_tool_call、post_tool_call\n不支持：SessionStart、Stop、Notification',
      counterpartAgent: 'claude',
      counterpartKey: 'project_settings',
    },
    {
      key: 'project_agents',
      label: '.codex/agents/',
      pathTemplate: '{project}/.codex/agents/',
      scope: 'project',
      kind: 'dir',
      format: 'dir',
      purpose: '项目级自定义 Agent，覆盖或扩展全局 Agent。',
      details:
        '与全局 agents 目录格式相同。\n项目级 Agent 优先级高于同名全局 Agent。\n\n从 Claude 迁移：.claude/agents/<name>.md → .codex/agents/<name>.md',
      counterpartAgent: 'claude',
      counterpartKey: 'project_agents',
    },
  ],
}
