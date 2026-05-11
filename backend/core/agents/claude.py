from .base import AgentBase, ConfigFileSpec


class ClaudeAgent(AgentBase):
    @property
    def id(self) -> str:
        return "claude"

    @property
    def name(self) -> str:
        return "Claude Code"

    @property
    def global_dir_template(self) -> str:
        return "{home}/.claude"

    @property
    def config_file_specs(self) -> list[ConfigFileSpec]:
        return [
            # ── Global layer ────────────────────────────────────────────────
            ConfigFileSpec(
                key="global_instructions",
                label="CLAUDE.md",
                path_template="{home}/.claude/CLAUDE.md",
                scope="global",
                kind="file",
                format="markdown",
                purpose="全局自然语言指令，在每次 Claude 会话启动时自动注入，优先级低于项目级 CLAUDE.md。",
                details=(
                    "加载顺序（低 → 高）：\n"
                    "1. ~/.claude/CLAUDE.md（此文件，全局）\n"
                    "2. {project}/CLAUDE.md（项目根）\n"
                    "3. 子目录 CLAUDE.md（嵌套加载）\n\n"
                    "适合放置：跨所有项目都适用的个人习惯、通用编码规范、全局禁止事项。"
                ),
                counterpart_agent="codex",
                counterpart_key="global_instructions",
                sync_strategy="迁移：内容复制并清洗 Claude 专属语法（/compact 等）",
            ),
            ConfigFileSpec(
                key="global_settings",
                label="settings.json",
                path_template="{home}/.claude/settings.json",
                scope="global",
                kind="file",
                format="json",
                purpose="定义 Claude 客户端的全局行为、工具权限等核心设置，影响对话风格、工具启用范围与输出策略。",
                details=(
                    "主要字段：\n"
                    "• hooks — 触发时机定义的 shell 命令\n"
                    "  支持事件：SessionStart / Stop / PreToolUse / PostToolUse / Notification\n"
                    "• permissions.allow / deny — 工具调用权限\n"
                    "• model — 覆盖默认模型\n"
                    "• env — 注入每个会话的环境变量\n\n"
                    "配置合并优先级（低 → 高）：\n"
                    "内置默认值 → 此文件（全局） → .claude/settings.json（项目）"
                    " → .claude/settings.local.json（本地覆盖） → 命令行参数"
                ),
                counterpart_agent="codex",
                counterpart_key="global_config",
                sync_strategy="不迁移（基础设施层）",
            ),
            ConfigFileSpec(
                key="global_auth",
                label=".claude.json",
                path_template="{home}/.claude.json",
                scope="global",
                kind="file",
                format="json",
                purpose="存储认证 token、用户偏好、遥测开关和服务端 A/B 功能缓存。由 Claude Code 自动管理。",
                details=(
                    "主要字段：\n"
                    "• oauthAccount — 已登录用户信息\n"
                    "• cachedGrowthBookFeatures — 服务端下发的功能开关缓存\n"
                    "• telemetryOptedOut — 数据收集开关\n\n"
                    "注意：此文件由工具自动管理，手动编辑可能破坏认证状态。不在同步范围内。"
                ),
            ),
            ConfigFileSpec(
                key="global_skills",
                label="skills/",
                path_template="{home}/.claude/skills/",
                scope="global",
                kind="dir",
                format="dir",
                purpose="全局可用的自定义技能（Skill），通过斜杠命令调用。每个子目录包含一个 SKILL.md 定义文件。",
                details=(
                    "结构：\n"
                    "  ~/.claude/skills/<skill-name>/SKILL.md\n\n"
                    "SKILL.md frontmatter：\n"
                    "  name:        调用时的斜杠命令名\n"
                    "  description: /help 中展示的说明\n\n"
                    "迁移目标：~/.codex/skills/<name>.md"
                ),
                counterpart_agent="codex",
                counterpart_key="global_skills",
                sync_strategy="迁移：SKILL.md → ~/.codex/skills/<name>.md（frontmatter 适配）",
            ),
            ConfigFileSpec(
                key="global_agents",
                label="agents/",
                path_template="{home}/.claude/agents/",
                scope="global",
                kind="dir",
                format="dir",
                purpose="全局自定义子 Agent 定义，所有项目均可使用。每个 .md 文件定义一个专门化角色。",
                details=(
                    "文件格式（带 YAML frontmatter 的 Markdown）：\n"
                    "---\nname: agent-name\ndescription: 何时使用此 agent\ntools: [Read, Write, Bash]\n---\n<系统提示>\n\n"
                    "全局 Agent 优先级低于项目级同名 Agent（.claude/agents/）。\n"
                    "Claude Code 根据任务描述自动匹配调用。"
                ),
                counterpart_agent="codex",
                counterpart_key="global_agents",
                sync_strategy="迁移：.md → ~/.codex/agents/<name>.md（frontmatter 适配）",
            ),
            ConfigFileSpec(
                key="global_commands",
                label="commands/",
                path_template="{home}/.claude/commands/",
                scope="global",
                kind="dir",
                format="dir",
                purpose="用户级自定义斜杠命令目录（Claude Code 1.x 引入）。每个 .md 文件即一个命令，通过 /<filename> 调用。",
                details=(
                    "每个文件直接映射为一个斜杠命令（无需 frontmatter，文件名即命令名）。\n\n"
                    "与 skills/ 的区别：\n"
                    "• skills/ — 需要 SKILL.md + 子目录结构，支持更复杂的 prompt 模板\n"
                    "• commands/ — 单文件即命令，更轻量\n\n"
                    "Codex 无等价机制，此目录不参与同步。"
                ),
            ),
            ConfigFileSpec(
                key="global_plugins",
                label="installed_plugins.json",
                path_template="{home}/.claude/plugins/installed_plugins.json",
                scope="global",
                kind="file",
                format="json",
                purpose="已安装插件的清单文件，由 Claude Code 自动管理。只读展示，不提供编辑/删除。",
                details=(
                    "由 Claude Code 插件系统自动写入，记录已安装插件的名称、版本和来源。\n\n"
                    "注意：不建议手动编辑，可能导致插件系统状态不一致。不在同步范围内。"
                ),
            ),
            # ── Project layer ────────────────────────────────────────────────
            ConfigFileSpec(
                key="project_instructions",
                label="CLAUDE.md",
                path_template="{project}/CLAUDE.md",
                scope="project",
                kind="file",
                format="markdown",
                purpose="项目级指令文件，在每次 Claude 会话启动时自动注入。定义编码规范、项目上下文和工作习惯。",
                details=(
                    "自动加载：Claude Code 启动时自动读取。\n"
                    "子目录的 CLAUDE.md 也会被加载（嵌套支持）。\n\n"
                    "常见内容：\n"
                    "• 项目概述和技术栈\n"
                    "• 编码规范和代码风格\n"
                    "• 测试/lint 命令\n"
                    "• 禁止 Claude 做的事情\n"
                    "• 外部 API 或架构背景"
                ),
                counterpart_agent="codex",
                counterpart_key="project_instructions",
                sync_strategy="迁移：内容复制到 AGENTS.md，清洗 Claude 专属语法（/compact 等斜杠命令引用）",
            ),
            ConfigFileSpec(
                key="project_settings",
                label=".claude/settings.json",
                path_template="{project}/.claude/settings.json",
                scope="project",
                kind="file",
                format="json",
                purpose="项目级 Claude 配置，结构与全局 settings.json 相同，但仅对当前项目生效，优先级高于全局。",
                details=(
                    "常见项目级用途：\n"
                    "• hooks.SessionStart — 安装项目依赖\n"
                    "• permissions.allow — 允许项目特定工具\n"
                    "• env — 注入项目环境变量\n\n"
                    "与全局配置合并时，项目配置优先。可被 .claude/settings.local.json 进一步覆盖（不提交 git）。"
                ),
            ),
            ConfigFileSpec(
                key="project_settings_local",
                label=".claude/settings.local.json",
                path_template="{project}/.claude/settings.local.json",
                scope="project",
                kind="file",
                format="json",
                purpose="项目本地覆盖层。结构与 settings.json 相同，但不应提交到 git（.gitignore 排除）。",
                details=(
                    "配置合并优先级中位于「项目配置之上、CLI 参数之下」，是独立的一层。\n\n"
                    "适合放置：本地开发专用覆盖（如个人 API key、调试工具权限）。\n\n"
                    "注意：此文件不参与同步，也不在备份范围内（个人敏感配置）。"
                ),
            ),
            ConfigFileSpec(
                key="project_agents",
                label=".claude/agents/",
                path_template="{project}/.claude/agents/",
                scope="project",
                kind="dir",
                format="dir",
                purpose="项目级自定义子 Agent。每个 .md 文件定义一个专门化角色，拥有独立的系统提示和工具权限。",
                details=(
                    "文件格式（带 YAML frontmatter 的 Markdown）：\n"
                    "---\n"
                    "name: agent-name\n"
                    "description: 何时使用此 agent\n"
                    "tools: [Read, Write, Bash]\n"
                    "---\n"
                    "<系统提示>\n\n"
                    "项目级 Agent 优先级高于全局同名 Agent。\n"
                    "迁移目标：.codex/agents/<name>.md（frontmatter 适配）"
                ),
                counterpart_agent="codex",
                counterpart_key="project_agents",
                sync_strategy="迁移：.md → .codex/agents/<name>.md（frontmatter 适配，tools 列表转换）",
            ),
            ConfigFileSpec(
                key="project_commands",
                label=".claude/commands/",
                path_template="{project}/.claude/commands/",
                scope="project",
                kind="dir",
                format="dir",
                purpose="项目级自定义斜杠命令目录。优先级高于全局 commands/，同名命令覆盖全局版本。",
                details=(
                    "与 ~/.claude/commands/ 格式相同，每个 .md 文件映射为一个斜杠命令。\n\n"
                    "适合放置项目专用的工作流命令（如发布脚本、代码生成模板）。\n"
                    "Codex 无等价机制，此目录不参与同步。"
                ),
            ),
            ConfigFileSpec(
                key="project_mcp",
                label=".mcp.json",
                path_template="{project}/.mcp.json",
                scope="project",
                kind="file",
                format="json",
                purpose="定义项目可用的 MCP（Model Context Protocol）服务器，扩展 Claude 的工具能力。",
                details=(
                    '格式：\n{ "mcpServers": { "<name>": { "command": ..., "args": [...] } } }\n\n'
                    "每个 server 作为子进程运行，通过 stdio 与 Claude 通信。\n"
                    "注意：MCP 服务器配置不在工作习惯同步范围内。"
                ),
            ),
        ]
