from .base import AgentBase, ConfigFileSpec


class CodexAgent(AgentBase):
    @property
    def id(self) -> str:
        return "codex"

    @property
    def name(self) -> str:
        return "OpenAI Codex CLI"

    @property
    def global_dir_template(self) -> str:
        return "{home}/.codex"

    @property
    def config_file_specs(self) -> list[ConfigFileSpec]:
        return [
            ConfigFileSpec(
                key="global_config",
                label="config.toml",
                path_template="{home}/.codex/config.toml",
                scope="global",
                kind="file",
                format="toml",
                purpose="Codex CLI 的主配置文件。控制模型、沙箱行为、MCP 服务器、对话风格和审批策略。",
                details=(
                    "主要字段：\n"
                    "• model — 默认模型（o4-mini、gpt-4.1 等）\n"
                    "• personality — 对话风格（friendly 等）\n"
                    "• approval — suggest | auto-edit | full-auto\n"
                    "• sandbox — 沙箱配置\n"
                    "• [mcp_servers] — MCP 服务器定义\n"
                    "• [features].codex_hooks — 启用 hooks\n\n"
                    "MCP server 格式：\n"
                    "[mcp_servers.<name>]\n"
                    'command = "npx"\n'
                    'args    = ["-y", "@mcp/server-github"]'
                ),
                counterpart_agent="claude",
                counterpart_key="global_settings",
            ),
            ConfigFileSpec(
                key="global_instructions",
                label="AGENTS.md",
                path_template="{home}/AGENTS.md",
                scope="global",
                kind="file",
                format="markdown",
                purpose="全局指令文件，在每次 Codex 会话启动时自动注入。优先级低于项目级 AGENTS.md。",
                details=(
                    "与 CLAUDE.md 的全局等价物，面向 Codex 生态。\n"
                    "避免包含 Claude 专属语法（/compact、/clear 等）。\n\n"
                    "与项目级 AGENTS.md 合并时，项目配置优先。"
                ),
                counterpart_agent="claude",
                counterpart_key="project_instructions",
            ),
            ConfigFileSpec(
                key="global_hooks",
                label="hooks.json",
                path_template="{home}/.codex/hooks.json",
                scope="global",
                kind="file",
                format="json",
                purpose="全局 Codex 钩子。需在 config.toml 中启用 [features].codex_hooks = true 才生效。",
                details=(
                    "支持事件：\n"
                    "• pre_tool_call  ≈ Claude PreToolUse\n"
                    "• post_tool_call ≈ Claude PostToolUse\n\n"
                    "不支持：SessionStart、Stop、Notification（Claude 专有）\n\n"
                    "启用方式（config.toml）：\n"
                    "[features]\ncodex_hooks = true"
                ),
                counterpart_agent="claude",
                counterpart_key="global_settings",
            ),
            ConfigFileSpec(
                key="global_agents",
                label=".codex/agents/",
                path_template="{home}/.codex/agents/",
                scope="global",
                kind="dir",
                format="dir",
                purpose="全局自定义 Agent 定义，供所有项目使用。",
                details=(
                    "文件格式（带 YAML frontmatter 的 Markdown）：\n"
                    "---\nname: agent-name\ndescription: 使用场景描述\n---\n<Agent 指令>\n\n"
                    "从 Claude 迁移：~/.claude/agents/ → 此目录"
                ),
                counterpart_agent="claude",
                counterpart_key="project_agents",
            ),
            ConfigFileSpec(
                key="global_skills",
                label=".agents/skills/",
                path_template="{home}/.agents/skills/",
                scope="global",
                kind="dir",
                format="dir",
                purpose="全局技能定义（Prompt 模板）。从 Claude skills 迁移后的目标位置。",
                details=(
                    "文件格式（带 YAML frontmatter 的 Markdown）：\n"
                    "---\nname: skill-name\ndescription: 使用场景\n---\n<技能提示>\n\n"
                    "从 Claude 迁移：~/.claude/skills/<name>/SKILL.md → ~/.agents/skills/<name>.md"
                ),
                counterpart_agent="claude",
                counterpart_key="global_skills",
            ),
            ConfigFileSpec(
                key="project_config",
                label=".codex/config.toml",
                path_template="{project}/.codex/config.toml",
                scope="project",
                kind="file",
                format="toml",
                purpose="项目级 Codex 配置，覆盖全局 config.toml，仅对当前项目生效。",
                details=(
                    "与全局 config.toml 结构相同，合并时项目配置优先。\n"
                    "不认识的字段会被保留而非删除（保守原则）。"
                ),
                counterpart_agent="claude",
                counterpart_key="project_settings",
            ),
            ConfigFileSpec(
                key="project_instructions",
                label="AGENTS.md",
                path_template="{project}/AGENTS.md",
                scope="project",
                kind="file",
                format="markdown",
                purpose="项目级 Codex 指令文件，等价于 CLAUDE.md。会话启动时自动注入，优先级高于全局 AGENTS.md。",
                details=(
                    "从 CLAUDE.md 迁移时需要：\n"
                    "• 移除斜杠命令引用（/compact、/clear 等）\n"
                    "• 将 Claude 工具名改为自然语言描述\n"
                    "• 保留所有项目约定、编码规范、工作习惯"
                ),
                counterpart_agent="claude",
                counterpart_key="project_instructions",
                sync_strategy="迁移目标：CLAUDE.md 内容适配后写入此文件",
            ),
            ConfigFileSpec(
                key="project_hooks",
                label=".codex/hooks.json",
                path_template="{project}/.codex/hooks.json",
                scope="project",
                kind="file",
                format="json",
                purpose="项目级 Codex 钩子，结构与全局 hooks.json 相同，仅对当前项目生效。",
                details=(
                    "需在 .codex/config.toml 中启用：\n"
                    "[features]\ncodex_hooks = true\n\n"
                    "支持事件：pre_tool_call、post_tool_call"
                ),
                counterpart_agent="claude",
                counterpart_key="project_settings",
            ),
            ConfigFileSpec(
                key="project_agents",
                label=".codex/agents/",
                path_template="{project}/.codex/agents/",
                scope="project",
                kind="dir",
                format="dir",
                purpose="项目级自定义 Agent，覆盖或扩展全局 Agent。",
                details=(
                    "格式与全局 agents 目录相同。\n"
                    "项目级 Agent 优先级高于同名全局 Agent。\n\n"
                    "从 Claude 迁移：.claude/agents/<name>.md → .codex/agents/<name>.md"
                ),
                counterpart_agent="claude",
                counterpart_key="project_agents",
            ),
            ConfigFileSpec(
                key="project_skills",
                label=".agents/skills/",
                path_template="{project}/.agents/skills/",
                scope="project",
                kind="dir",
                format="dir",
                purpose="项目级技能定义，优先级高于全局同名技能。",
                details=(
                    "格式与全局 .agents/skills/ 相同。\n"
                    "从 Claude 迁移：.claude/skills/<name>/SKILL.md → .agents/skills/<name>.md"
                ),
                counterpart_agent="claude",
                counterpart_key="global_skills",
            ),
        ]
