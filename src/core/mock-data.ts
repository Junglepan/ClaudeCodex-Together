/**
 * Mock data — realistic Claude / Codex configuration scenarios.
 * Used when backend is unreachable so the UI can be previewed standalone.
 */

import type {
  ApiAgentSummary,
  ApiConfigFile,
  ApiFileDetail,
  ApiSyncPlan,
  ApiSyncResult,
} from './api'

const HOME = '/Users/sarah'
const PROJECT = '/Users/sarah/projects/northstar-portal'

// ── Agent summaries ──────────────────────────────────────────────────────────

export const mockAgents: ApiAgentSummary[] = [
  {
    id: 'claude',
    name: 'Claude Code',
    status: 'active',
    global_path: `${HOME}/.claude`,
    file_count: 6,
  },
  {
    id: 'codex',
    name: 'OpenAI Codex CLI',
    status: 'partial',
    global_path: `${HOME}/.codex`,
    file_count: 2,
  },
]

// ── Claude config files ──────────────────────────────────────────────────────

export const mockClaudeFiles: ApiConfigFile[] = [
  {
    key: 'global_settings',
    label: 'settings.json',
    path: `${HOME}/.claude/settings.json`,
    exists: true,
    scope: 'global',
    kind: 'file',
    format: 'json',
    status: 'active',
    size_bytes: 2456,
    modified_at: '2024-05-18T14:32:47',
    purpose: '定义 Claude 客户端的全局行为、工具权限等核心设置',
  },
  {
    key: 'global_auth',
    label: '.claude.json',
    path: `${HOME}/.claude.json`,
    exists: true,
    scope: 'global',
    kind: 'file',
    format: 'json',
    status: 'active',
    size_bytes: 18432,
    modified_at: '2024-05-19T09:12:03',
  },
  {
    key: 'global_skills',
    label: 'skills/',
    path: `${HOME}/.claude/skills/`,
    exists: true,
    scope: 'global',
    kind: 'dir',
    format: 'dir',
    status: 'active',
    modified_at: '2024-05-15T11:08:22',
  },
  {
    key: 'global_stop_hook',
    label: 'stop-hook-git-check.sh',
    path: `${HOME}/.claude/stop-hook-git-check.sh`,
    exists: true,
    scope: 'global',
    kind: 'file',
    format: 'shell',
    status: 'active',
    size_bytes: 2165,
    modified_at: '2024-05-10T16:44:18',
  },
  {
    key: 'project_instructions',
    label: 'CLAUDE.md',
    path: `${PROJECT}/CLAUDE.md`,
    exists: true,
    scope: 'project',
    kind: 'file',
    format: 'markdown',
    status: 'active',
    size_bytes: 4521,
    modified_at: '2024-05-19T10:05:33',
  },
  {
    key: 'project_settings',
    label: '.claude/settings.json',
    path: `${PROJECT}/.claude/settings.json`,
    exists: true,
    scope: 'project',
    kind: 'file',
    format: 'json',
    status: 'active',
    size_bytes: 892,
    modified_at: '2024-05-17T08:30:12',
  },
  {
    key: 'project_agents',
    label: '.claude/agents/',
    path: `${PROJECT}/.claude/agents/`,
    exists: true,
    scope: 'project',
    kind: 'dir',
    format: 'dir',
    status: 'active',
    modified_at: '2024-05-16T13:22:45',
  },
  {
    key: 'project_mcp',
    label: '.mcp.json',
    path: `${PROJECT}/.mcp.json`,
    exists: false,
    scope: 'project',
    kind: 'file',
    format: 'json',
    status: 'missing',
  },
]

// ── Codex config files ───────────────────────────────────────────────────────

export const mockCodexFiles: ApiConfigFile[] = [
  {
    key: 'global_config',
    label: 'config.toml',
    path: `${HOME}/.codex/config.toml`,
    exists: true,
    scope: 'global',
    kind: 'file',
    format: 'toml',
    status: 'active',
    size_bytes: 612,
    modified_at: '2024-05-12T17:55:01',
  },
  {
    key: 'global_instructions',
    label: 'AGENTS.md',
    path: `${HOME}/AGENTS.md`,
    exists: false,
    scope: 'global',
    kind: 'file',
    format: 'markdown',
    status: 'missing',
  },
  {
    key: 'global_hooks',
    label: 'hooks.json',
    path: `${HOME}/.codex/hooks.json`,
    exists: false,
    scope: 'global',
    kind: 'file',
    format: 'json',
    status: 'missing',
  },
  {
    key: 'global_agents',
    label: '.codex/agents/',
    path: `${HOME}/.codex/agents/`,
    exists: false,
    scope: 'global',
    kind: 'dir',
    format: 'dir',
    status: 'missing',
  },
  {
    key: 'global_skills',
    label: '.agents/skills/',
    path: `${HOME}/.agents/skills/`,
    exists: true,
    scope: 'global',
    kind: 'dir',
    format: 'dir',
    status: 'active',
    modified_at: '2024-05-14T10:18:33',
  },
  {
    key: 'project_config',
    label: '.codex/config.toml',
    path: `${PROJECT}/.codex/config.toml`,
    exists: false,
    scope: 'project',
    kind: 'file',
    format: 'toml',
    status: 'missing',
  },
  {
    key: 'project_instructions',
    label: 'AGENTS.md',
    path: `${PROJECT}/AGENTS.md`,
    exists: false,
    scope: 'project',
    kind: 'file',
    format: 'markdown',
    status: 'missing',
  },
  {
    key: 'project_hooks',
    label: '.codex/hooks.json',
    path: `${PROJECT}/.codex/hooks.json`,
    exists: false,
    scope: 'project',
    kind: 'file',
    format: 'json',
    status: 'missing',
  },
  {
    key: 'project_agents',
    label: '.codex/agents/',
    path: `${PROJECT}/.codex/agents/`,
    exists: false,
    scope: 'project',
    kind: 'dir',
    format: 'dir',
    status: 'missing',
  },
  {
    key: 'project_skills',
    label: '.agents/skills/',
    path: `${PROJECT}/.agents/skills/`,
    exists: false,
    scope: 'project',
    kind: 'dir',
    format: 'dir',
    status: 'missing',
  },
]

// ── File contents ────────────────────────────────────────────────────────────

const FILE_CONTENTS: Record<string, string> = {
  [`${HOME}/.claude/settings.json`]: `{
  "$schema": "https://json.schemastore.org/claude-code-settings.json",
  "hooks": {
    "Stop": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "~/.claude/stop-hook-git-check.sh"
          }
        ]
      }
    ],
    "SessionStart": [
      {
        "matcher": "startup",
        "hooks": [
          { "type": "command", "command": "~/.claude/setup-env.sh" }
        ]
      }
    ]
  },
  "permissions": {
    "allow": ["Skill", "Bash(npm test)", "Bash(npm run lint)"],
    "deny": ["Bash(rm -rf*)"]
  },
  "model": "claude-sonnet-4-6",
  "includeCoAuthoredBy": true
}`,
  [`${HOME}/.claude.json`]: `{
  "oauthAccount": {
    "email": "sarah@example.com",
    "uuid": "a3f9c1d8-..."
  },
  "telemetryOptedOut": false,
  "cachedGrowthBookFeatures": {
    "tengu_ochre_hollow": false,
    "tengu_amber_sentinel": true
  },
  "hasCompletedProjectOnboarding": true
}`,
  [`${HOME}/.claude/stop-hook-git-check.sh`]: `#!/bin/bash
# Read JSON input from stdin
input=$(cat)

# Check recursion prevention
stop_hook_active=$(echo "$input" | jq -r '.stop_hook_active')
if [[ "$stop_hook_active" = "true" ]]; then
  exit 0
fi

# Check git status
if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "There are uncommitted changes." >&2
  exit 2
fi

exit 0`,
  [`${PROJECT}/CLAUDE.md`]: `# Northstar Portal

Customer-facing support portal built with Next.js 14 + Postgres.

## Tech Stack
- Next.js 14 (App Router)
- Postgres 15 + Prisma
- TypeScript strict mode
- Tailwind CSS

## Coding Conventions
- Use server components by default; mark client components explicitly
- Database access only through Prisma client in \`db/\`
- All API routes return zod-validated responses
- Use /compact when context gets too large

## Test Commands
- Unit tests: \`npm run test:unit\`
- E2E tests: \`npm run test:e2e\`
- Lint: \`npm run lint\`

## Things to never do
- Never commit \`.env.local\`
- Never push directly to \`main\`
- Use the Bash tool only for build/test commands`,
  [`${PROJECT}/.claude/settings.json`]: `{
  "hooks": {
    "SessionStart": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "$CLAUDE_PROJECT_DIR/.claude/hooks/session-start.sh"
          }
        ]
      }
    ]
  },
  "permissions": {
    "allow": ["Bash(npm test)", "Bash(npm run dev)"]
  }
}`,
  [`${HOME}/.codex/config.toml`]: `model = "o4-mini"
personality = "friendly"
approval = "auto-edit"

[features]
codex_hooks = false

[mcp_servers.github]
command = "npx"
args = ["-y", "@modelcontextprotocol/server-github"]`,
}

// ── Helper: build mock file detail ──────────────────────────────────────────

const FILE_DETAIL_META: Record<string, { purpose: string; details: string; counterpartKey?: string; counterpartAgent?: string }> = {
  global_settings: {
    purpose: '定义 Claude 客户端的全局行为、工具权限等核心设置，影响对话风格、工具启用范围与输出策略。',
    details: '主要字段：\n• hooks — 触发时机定义的 shell 命令\n• permissions.allow / deny — 工具调用权限\n• model — 覆盖默认模型\n• env — 注入每个会话的环境变量\n\n生效原理：Claude 启动时优先加载此文件，覆盖内置默认值。\n优先级：用户配置 > 项目配置 > 全局默认',
    counterpartAgent: 'codex',
    counterpartKey: 'global_config',
  },
  global_auth: {
    purpose: '存储认证 token、用户偏好、遥测开关和服务端 A/B 功能缓存。由 Claude Code 自动管理。',
    details: '主要字段：\n• oauthAccount — 已登录用户信息\n• cachedGrowthBookFeatures — 服务端下发的功能开关缓存\n• telemetryOptedOut — 数据收集开关\n\n注意：此文件由工具自动管理，手动编辑可能破坏认证状态。不在同步范围内。',
  },
  global_skills: {
    purpose: '全局可用的自定义技能（Skill），通过斜杠命令调用。',
    details: '结构：\n  ~/.claude/skills/<skill-name>/SKILL.md\n\nSKILL.md frontmatter：\n  name:        调用时的斜杠命令名\n  description: /help 中展示的说明\n\n迁移目标：~/.agents/skills/<name>.md',
    counterpartAgent: 'codex',
    counterpartKey: 'global_skills',
  },
  global_stop_hook: {
    purpose: 'Stop 事件钩子脚本：检查未提交变更和未推送提交，若有则阻止会话关闭（exit 2）。',
    details: '通过 stdin 接收 JSON，包含 stop_hook_active 等字段。\n\n退出码：\n  0 — 允许关闭\n  2 — 阻止关闭\n\n注意：Codex 没有 Stop 事件等价物，此 hook 无法迁移。',
  },
  project_instructions: {
    purpose: '项目级指令文件，在每次 Claude 会话启动时自动注入。',
    details: '自动加载：Claude Code 启动时自动读取。\n子目录的 CLAUDE.md 也会被加载（嵌套支持）。\n\n常见内容：\n• 项目概述和技术栈\n• 编码规范和代码风格\n• 测试/lint 命令\n• 禁止 Claude 做的事情',
    counterpartAgent: 'codex',
    counterpartKey: 'project_instructions',
  },
  global_config: {
    purpose: 'Codex CLI 的主配置文件。控制模型、沙箱行为、MCP 服务器、对话风格和审批策略。',
    details: '主要字段：\n• model — 默认模型\n• personality — 对话风格\n• approval — suggest | auto-edit | full-auto\n• [mcp_servers] — MCP 服务器定义',
    counterpartAgent: 'claude',
    counterpartKey: 'global_settings',
  },
  global_instructions: {
    purpose: '全局指令文件，在每次 Codex 会话启动时自动注入。',
    details: '与 CLAUDE.md 的全局等价物，面向 Codex 生态。\n避免包含 Claude 专属语法。',
    counterpartAgent: 'claude',
    counterpartKey: 'project_instructions',
  },
}

export function buildMockFileDetail(agent: string, key: string): ApiFileDetail {
  const files = agent === 'claude' ? mockClaudeFiles : mockCodexFiles
  const file = files.find((f) => f.key === key)
  if (!file) {
    return {
      path: '',
      exists: false,
      purpose: '',
      details: '',
    }
  }

  const meta = FILE_DETAIL_META[key] ?? { purpose: file.purpose ?? '', details: '' }
  const counterpartAgent = meta.counterpartAgent
  const counterpartKey = meta.counterpartKey
  let counterpartPath: string | undefined
  let counterpartExists: boolean | undefined

  if (counterpartAgent && counterpartKey) {
    const cFiles = counterpartAgent === 'claude' ? mockClaudeFiles : mockCodexFiles
    const cFile = cFiles.find((f) => f.key === counterpartKey)
    if (cFile) {
      counterpartPath = cFile.path
      counterpartExists = cFile.exists
    }
  }

  return {
    path: file.path,
    exists: file.exists,
    content: file.exists ? FILE_CONTENTS[file.path] : undefined,
    purpose: meta.purpose,
    details: meta.details,
    counterpart_agent: counterpartAgent,
    counterpart_path: counterpartPath,
    counterpart_exists: counterpartExists,
  }
}

// ── Sync mock ────────────────────────────────────────────────────────────────

export const mockSyncPlan: ApiSyncPlan = {
  items: [
    {
      status: 'added',
      type: 'Instruction',
      name: 'CLAUDE.md',
      source: `${PROJECT}/CLAUDE.md`,
      target: `${PROJECT}/AGENTS.md`,
      notes: 'Converted to AGENTS.md',
    },
    {
      status: 'check',
      type: 'Instruction',
      name: 'CLAUDE.md',
      source: `${PROJECT}/CLAUDE.md`,
      target: `${PROJECT}/AGENTS.md`,
      notes: 'Contains Claude tool references — review before using',
    },
    {
      status: 'added',
      type: 'Skill',
      name: 'pr-review',
      source: `${HOME}/.claude/skills/pr-review/SKILL.md`,
      target: `${HOME}/.agents/skills/pr-review.md`,
      notes: 'Converted into a Codex skill',
    },
    {
      status: 'added',
      type: 'Skill',
      name: 'deploy-check',
      source: `${HOME}/.claude/skills/deploy-check/SKILL.md`,
      target: `${HOME}/.agents/skills/deploy-check.md`,
      notes: 'Converted into a Codex skill',
    },
    {
      status: 'added',
      type: 'Subagent',
      name: 'release-lead',
      source: `${PROJECT}/.claude/agents/release-lead.md`,
      target: `${PROJECT}/.codex/agents/release-lead.md`,
      notes: 'Added as a Codex subagent',
    },
    {
      status: 'check',
      type: 'Subagent',
      name: 'security-audit',
      source: `${PROJECT}/.claude/agents/security-audit.md`,
      target: `${PROJECT}/.codex/agents/security-audit.md`,
      notes: 'Added as a Codex subagent; tool list preserved as comment — verify Codex tool names',
    },
    {
      status: 'not_added',
      type: 'Hook',
      name: 'Stop',
      source: `${HOME}/.claude/settings.json`,
      target: '',
      notes: 'No Codex equivalent; document behavior in AGENTS.md manually',
    },
    {
      status: 'not_added',
      type: 'Hook',
      name: 'SessionStart',
      source: `${HOME}/.claude/settings.json`,
      target: '',
      notes: 'No Codex equivalent; document behavior in AGENTS.md manually',
    },
  ],
  stats: { migratable: 6, needs_conversion: 2, conflicts: 0, ignored: 2 },
}

export const mockSyncResult: ApiSyncResult = {
  dry_run: false,
  items: mockSyncPlan.items,
  written: [
    `${PROJECT}/AGENTS.md`,
    `${HOME}/.agents/skills/pr-review.md`,
    `${HOME}/.agents/skills/deploy-check.md`,
    `${PROJECT}/.codex/agents/release-lead.md`,
    `${PROJECT}/.codex/agents/security-audit.md`,
  ],
  skipped: [],
}

// ── Meta ─────────────────────────────────────────────────────────────────────

export const mockMeta = {
  project_path: PROJECT,
  home_path: HOME,
  platform: 'macOS 14.5 (23F79)',
  hostname: 'Sarahs-MacBook-Pro.local',
  python_version: '3.11.15',
}
