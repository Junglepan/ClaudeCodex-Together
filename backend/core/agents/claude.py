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
                    "生效原理：Claude 启动时优先加载此文件，覆盖内置默认值。\n"
                    "优先级：用户配置 > 项目配置 > 全局默认"
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
                    "迁移目标：~/.agents/skills/<name>.md"
                ),
                counterpart_agent="codex",
                counterpart_key="global_skills",
                sync_strategy="迁移：SKILL.md → ~/.agents/skills/<name>.md（frontmatter 适配）",
            ),
            ConfigFileSpec(
                key="global_stop_hook",
                label="stop-hook-git-check.sh",
                path_template="{home}/.claude/stop-hook-git-check.sh",
                scope="global",
                kind="file",
                format="shell",
                purpose="Stop 事件钩子脚本：检查未提交变更和未推送提交，若有则阻止会话关闭（exit 2）。",
                details=(
                    "通过 stdin 接收 JSON，包含 stop_hook_active 等字段。\n\n"
                    "退出码：\n  0 — 允许关闭\n  2 — 阻止关闭\n\n"
                    "注意：Codex 没有 Stop 事件等价物，此 hook 无法迁移。"
                ),
            ),
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
                    "与全局配置合并时，项目配置优先。"
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
                    "迁移目标：.codex/agents/<name>.md（frontmatter 适配）"
                ),
                counterpart_agent="codex",
                counterpart_key="project_agents",
                sync_strategy="迁移：.md → .codex/agents/<name>.md（frontmatter 适配，tools 列表转换）",
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
