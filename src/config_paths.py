"""
Definitions of all known Claude and Codex configuration files,
their purposes, and how they relate to each other.
"""

from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional


@dataclass
class ConfigEntry:
    """Describes a single configuration file or directory."""
    key: str                      # Unique identifier
    label: str                    # Human-readable name
    path_template: str            # Path (may contain {home}, {project})
    scope: str                    # "global" or "project"
    kind: str                     # "file" or "dir"
    format: str                   # "json", "toml", "markdown", "shell", "dir"
    purpose: str                  # What this config does
    details: str                  # Deeper explanation of fields / behavior
    codex_equivalent: Optional[str] = None   # Paired Codex/Claude key
    sync_strategy: Optional[str] = None      # How it syncs across tools


# ── Claude config entries ────────────────────────────────────────────────────

CLAUDE_ENTRIES: list[ConfigEntry] = [
    ConfigEntry(
        key="claude_global_settings",
        label="Global Settings",
        path_template="{home}/.claude/settings.json",
        scope="global",
        kind="file",
        format="json",
        purpose="Primary global configuration for Claude Code. Controls hooks, permissions, model defaults, and feature flags.",
        details=(
            "Key fields:\n"
            "  • hooks         – Shell commands triggered on events (SessionStart, Stop, PreToolUse, PostToolUse, Notification)\n"
            "  • permissions   – allow/deny lists for tools and commands\n"
            "  • model         – default LLM model override\n"
            "  • env           – environment variables injected into every session\n"
            "  • includeCoAuthoredBy – whether to add 'Co-authored-by' to git commits\n"
            "Hook events: SessionStart | Stop | PreToolUse | PostToolUse | Notification"
        ),
        codex_equivalent="codex_global_config",
        sync_strategy="hooks → codex hooks.json; model → config.toml; permissions → config.toml",
    ),
    ConfigEntry(
        key="claude_global_auth",
        label="Global Auth & Feature Cache",
        path_template="{home}/.claude.json",
        scope="global",
        kind="file",
        format="json",
        purpose="Stores authentication tokens, user preferences, telemetry opt-in, and cached server-side feature flags (GrowthBook). Not meant for manual editing.",
        details=(
            "Key fields:\n"
            "  • oauthAccount  – authenticated user info\n"
            "  • cachedGrowthBookFeatures – A/B feature flags from Anthropic servers\n"
            "  • telemetryOptedOut – analytics opt-out flag\n"
            "  • hasCompletedProjectOnboarding – UI state\n"
            "This file is auto-managed by Claude Code. Editing it manually may break auth."
        ),
        codex_equivalent=None,
        sync_strategy=None,
    ),
    ConfigEntry(
        key="claude_global_skills",
        label="Global Skills Directory",
        path_template="{home}/.claude/skills/",
        scope="global",
        kind="dir",
        format="dir",
        purpose="User-defined slash-command skills available across all projects. Each subdirectory is one skill containing a SKILL.md with instructions.",
        details=(
            "Structure:\n"
            "  ~/.claude/skills/<skill-name>/SKILL.md\n\n"
            "SKILL.md frontmatter:\n"
            "  name:        slug used to invoke as /<name>\n"
            "  description: shown in /help output\n\n"
            "Skills are invoked as slash commands inside Claude Code sessions."
        ),
        codex_equivalent="codex_global_skills",
        sync_strategy="Each SKILL.md → .agents/skills/<name>.md (content adapted)",
    ),
    ConfigEntry(
        key="claude_global_stop_hook",
        label="Global Stop Hook Script",
        path_template="{home}/.claude/stop-hook-git-check.sh",
        scope="global",
        kind="file",
        format="shell",
        purpose="Shell script executed when Claude Code stops. This specific hook checks for uncommitted git changes and unpushed commits, blocking the stop if work is unsaved.",
        details=(
            "Receives JSON via stdin with fields:\n"
            "  • stop_hook_active – prevent recursion\n"
            "  • session_id, transcript_path\n\n"
            "Exit codes:\n"
            "  0 – allow stop\n"
            "  2 – block stop with message on stderr\n\n"
            "Registered in ~/.claude/settings.json under hooks.Stop."
        ),
        codex_equivalent=None,
        sync_strategy="No direct Codex equivalent; manual review needed",
    ),
    ConfigEntry(
        key="claude_project_settings",
        label="Project Settings",
        path_template="{project}/.claude/settings.json",
        scope="project",
        kind="file",
        format="json",
        purpose="Project-specific Claude configuration. Same schema as global settings but applies only to this project. Takes precedence over global settings.",
        details=(
            "Supports the same fields as the global settings.json.\n"
            "Common project uses:\n"
            "  • hooks.SessionStart – install dependencies on session start\n"
            "  • permissions.allow  – allow project-specific tools/commands\n"
            "  • env                – project environment variables\n\n"
            "Merged with global settings at runtime (project wins on conflicts)."
        ),
        codex_equivalent="codex_project_config",
        sync_strategy="hooks → .codex/hooks.json; model → .codex/config.toml",
    ),
    ConfigEntry(
        key="claude_project_hooks_dir",
        label="Project Hooks Directory",
        path_template="{project}/.claude/hooks/",
        scope="project",
        kind="dir",
        format="dir",
        purpose="Directory for project-level hook shell scripts. Scripts here are referenced from .claude/settings.json hooks configuration.",
        details=(
            "Typical scripts:\n"
            "  session-start.sh – dependency installation hook\n"
            "  pre-tool-use.sh  – validate/block tool calls\n"
            "  post-tool-use.sh – audit or react to tool results\n\n"
            "Scripts receive JSON via stdin and communicate back via stdout/stderr and exit codes."
        ),
        codex_equivalent=None,
        sync_strategy="Scripts referenced by hook entries – migrate hook entry, script needs manual port",
    ),
    ConfigEntry(
        key="claude_project_instructions",
        label="Project Instructions (CLAUDE.md)",
        path_template="{project}/CLAUDE.md",
        scope="project",
        kind="file",
        format="markdown",
        purpose="Natural-language instructions injected into every Claude session for this project. Defines coding standards, architecture notes, workflow rules, and tool guidance.",
        details=(
            "Automatically loaded by Claude Code when starting a session in this directory.\n"
            "Can be nested: subdirectory CLAUDE.md files are also loaded.\n\n"
            "Common contents:\n"
            "  • Project overview and tech stack\n"
            "  • Coding conventions and style rules\n"
            "  • Commands to run tests / linters\n"
            "  • Things Claude should never do\n"
            "  • Context about external APIs or architecture"
        ),
        codex_equivalent="codex_project_instructions",
        sync_strategy="Content copied to AGENTS.md; Claude-specific directives flagged for review",
    ),
    ConfigEntry(
        key="claude_project_mcp",
        label="Project MCP Servers (.mcp.json)",
        path_template="{project}/.mcp.json",
        scope="project",
        kind="file",
        format="json",
        purpose="Defines Model Context Protocol (MCP) servers available in this project. MCP servers extend Claude with custom tools, resources, and prompts.",
        details=(
            "Schema:\n"
            "  { \"mcpServers\": { \"<name>\": { \"command\": ..., \"args\": [...], \"env\": {...} } } }\n\n"
            "Each server runs as a subprocess and communicates over stdio.\n"
            "Claude Code launches them automatically at session start.\n\n"
            "Also supported: global MCP config via ~/.claude/settings.json mcpServers field."
        ),
        codex_equivalent="codex_project_config",
        sync_strategy="Each mcpServers entry → [mcp_servers.<name>] in .codex/config.toml",
    ),
    ConfigEntry(
        key="claude_project_agents_dir",
        label="Project Agents Directory",
        path_template="{project}/.claude/agents/",
        scope="project",
        kind="dir",
        format="dir",
        purpose="Custom subagent definitions for this project. Each .md file defines a specialized agent with its own system prompt and tool access.",
        details=(
            "File format: Markdown with YAML frontmatter\n"
            "  ---\n"
            "  name: agent-name\n"
            "  description: when to use this agent\n"
            "  tools: [Read, Write, Bash]\n"
            "  ---\n"
            "  <system prompt>\n\n"
            "Agents are invoked by Claude Code when the task matches their description."
        ),
        codex_equivalent="codex_project_agents",
        sync_strategy="Each agent .md → .codex/agents/<name>.md (frontmatter adapted)",
    ),
]

# ── Codex config entries ─────────────────────────────────────────────────────

CODEX_ENTRIES: list[ConfigEntry] = [
    ConfigEntry(
        key="codex_global_config",
        label="Global Config",
        path_template="{home}/.codex/config.toml",
        scope="global",
        kind="file",
        format="toml",
        purpose="Primary global configuration for Codex CLI. Controls model selection, sandbox behavior, MCP servers, personality, and approval policies.",
        details=(
            "Key fields:\n"
            "  • model           – default model (e.g. 'o4-mini', 'gpt-4.1')\n"
            "  • personality     – tone guidance (e.g. 'friendly')\n"
            "  • approval        – 'suggest' | 'auto-edit' | 'full-auto'\n"
            "  • sandbox         – 'network-disabled' | enabled options\n"
            "  • [mcp_servers]   – inline MCP server definitions\n"
            "  • [features]      – feature flags (codex_hooks, etc.)\n\n"
            "MCP server format:\n"
            "  [mcp_servers.<name>]\n"
            "  command = 'npx'\n"
            "  args    = ['-y', '@modelcontextprotocol/server-github']"
        ),
        codex_equivalent="claude_global_settings",
        sync_strategy="claude settings.json model + sandbox → this file",
    ),
    ConfigEntry(
        key="codex_global_instructions",
        label="Global Instructions (AGENTS.md)",
        path_template="{home}/AGENTS.md",
        scope="global",
        kind="file",
        format="markdown",
        purpose="Global natural-language instructions for Codex (and other AGENTS.md-aware tools). Defines behavior across all projects.",
        details=(
            "Loaded automatically by Codex at session start.\n"
            "Lower priority than project-level AGENTS.md.\n\n"
            "Same markdown format as CLAUDE.md but targeted at Codex.\n"
            "Avoid Claude-specific directives (slash commands, hook syntax)."
        ),
        codex_equivalent="claude_project_instructions",
        sync_strategy="~/.claude/CLAUDE.md (if exists) or project CLAUDE.md → here",
    ),
    ConfigEntry(
        key="codex_global_hooks",
        label="Global Hooks",
        path_template="{home}/.codex/hooks.json",
        scope="global",
        kind="file",
        format="json",
        purpose="Defines shell commands triggered on Codex lifecycle events globally. Must have [features].codex_hooks = true in config.toml to activate.",
        details=(
            "Schema:\n"
            "  { \"<event>\": [{ \"command\": \"...\", \"matcher\": \"...\" }] }\n\n"
            "Supported events:\n"
            "  • pre_tool_call   – runs before any tool executes (≈ Claude PreToolUse)\n"
            "  • post_tool_call  – runs after tool completes (≈ Claude PostToolUse)\n\n"
            "NOT supported in Codex:\n"
            "  • SessionStart, Stop, Notification (Claude-only events)\n\n"
            "Enable hooks:\n"
            "  [features]\n"
            "  codex_hooks = true   # in config.toml"
        ),
        codex_equivalent="claude_global_settings",
        sync_strategy="Claude PreToolUse/PostToolUse hooks → pre_tool_call/post_tool_call",
    ),
    ConfigEntry(
        key="codex_global_agents",
        label="Global Agents Directory",
        path_template="{home}/.codex/agents/",
        scope="global",
        kind="dir",
        format="dir",
        purpose="Custom global agent definitions for Codex. Each file is a subagent with its own instructions and tool access.",
        details=(
            "File format: Markdown with YAML frontmatter\n"
            "  ---\n"
            "  name: agent-name\n"
            "  description: purpose of this agent\n"
            "  ---\n"
            "  <agent instructions>\n\n"
            "Codex selects agents based on task context matching descriptions."
        ),
        codex_equivalent="claude_project_agents_dir",
        sync_strategy="~/.claude/agents/ → here (frontmatter adapted)",
    ),
    ConfigEntry(
        key="codex_global_skills",
        label="Global Skills Directory",
        path_template="{home}/.agents/skills/",
        scope="global",
        kind="dir",
        format="dir",
        purpose="User-defined skills (prompt templates) available globally in Codex. Each .md file is one skill.",
        details=(
            "File format: Markdown with YAML frontmatter\n"
            "  ---\n"
            "  name: skill-name\n"
            "  description: when to use\n"
            "  ---\n"
            "  <skill prompt>\n\n"
            "Migrated from Claude skills (.claude/skills/**/SKILL.md)."
        ),
        codex_equivalent="claude_global_skills",
        sync_strategy="~/.claude/skills/<name>/SKILL.md → ~/.agents/skills/<name>.md",
    ),
    ConfigEntry(
        key="codex_project_config",
        label="Project Config",
        path_template="{project}/.codex/config.toml",
        scope="project",
        kind="file",
        format="toml",
        purpose="Project-specific Codex configuration. Overrides global config for this project. Same TOML schema as global config.toml.",
        details=(
            "Common project-level settings:\n"
            "  • model    – override model per project\n"
            "  • approval – stricter or looser approval mode\n"
            "  • [mcp_servers] – project-specific MCP servers\n\n"
            "Merged with global config at runtime (project wins).\n"
            "Unrecognized keys are preserved and ignored."
        ),
        codex_equivalent="claude_project_settings",
        sync_strategy="claude .claude/settings.json → here; .mcp.json mcpServers → [mcp_servers]",
    ),
    ConfigEntry(
        key="codex_project_instructions",
        label="Project Instructions (AGENTS.md)",
        path_template="{project}/AGENTS.md",
        scope="project",
        kind="file",
        format="markdown",
        purpose="Project-level instructions for Codex. Equivalent of CLAUDE.md for the Codex ecosystem. Loaded automatically at session start.",
        details=(
            "Higher priority than global AGENTS.md.\n"
            "Can include subdirectory AGENTS.md files (same as CLAUDE.md nesting).\n\n"
            "Migration from CLAUDE.md:\n"
            "  • Remove Claude slash-command references (/compact, /clear, etc.)\n"
            "  • Replace Claude hook syntax with plain descriptions\n"
            "  • Keep all project context, conventions, and rules"
        ),
        codex_equivalent="claude_project_instructions",
        sync_strategy="CLAUDE.md content → here with Claude-specific syntax cleaned",
    ),
    ConfigEntry(
        key="codex_project_hooks",
        label="Project Hooks",
        path_template="{project}/.codex/hooks.json",
        scope="project",
        kind="file",
        format="json",
        purpose="Project-specific hooks for Codex. Same schema as global hooks.json but applies only to this project.",
        details=(
            "Must enable in .codex/config.toml:\n"
            "  [features]\n"
            "  codex_hooks = true\n\n"
            "Supported events: pre_tool_call, post_tool_call\n"
            "Not supported: SessionStart, Stop, Notification\n\n"
            "Hook commands receive tool call info via env vars or stdin (tool-dependent)."
        ),
        codex_equivalent="claude_project_settings",
        sync_strategy="Claude PreToolUse/PostToolUse → pre_tool_call/post_tool_call here",
    ),
    ConfigEntry(
        key="codex_project_agents",
        label="Project Agents Directory",
        path_template="{project}/.codex/agents/",
        scope="project",
        kind="dir",
        format="dir",
        purpose="Project-level custom agents for Codex. Overrides or extends global agents for this project's context.",
        details=(
            "Same format as global agents directory.\n"
            "Project agents take precedence over global agents with the same name.\n\n"
            "Migration from Claude agents (.claude/agents/):\n"
            "  • Copy frontmatter, adapt 'tools' list to Codex tool names\n"
            "  • Keep system prompt content intact"
        ),
        codex_equivalent="claude_project_agents_dir",
        sync_strategy=".claude/agents/<name>.md → .codex/agents/<name>.md",
    ),
    ConfigEntry(
        key="codex_project_skills",
        label="Project Skills Directory",
        path_template="{project}/.agents/skills/",
        scope="project",
        kind="dir",
        format="dir",
        purpose="Project-level skill definitions for Codex. Takes precedence over global skills of the same name.",
        details=(
            "Same format as global .agents/skills/.\n"
            "Migration from Claude project skills:\n"
            "  .claude/commands/<name>.md → .agents/skills/<name>.md"
        ),
        codex_equivalent="claude_global_skills",
        sync_strategy=".claude/skills/<name>/SKILL.md → .agents/skills/<name>.md",
    ),
]

# ── Hook event cross-reference ───────────────────────────────────────────────

HOOK_EVENT_MAP = {
    "SessionStart": {
        "claude": "Runs when a Claude Code session starts. Used for dependency installation, environment setup.",
        "codex": None,
        "note": "No Codex equivalent. Codex does not have a session-start hook.",
    },
    "Stop": {
        "claude": "Runs when Claude Code session ends. Can block exit (exit code 2). Used for commit checks.",
        "codex": None,
        "note": "No Codex equivalent. Document the behavior in AGENTS.md as a reminder.",
    },
    "PreToolUse": {
        "claude": "Runs before any tool call. Can block the tool (exit 2) or modify behavior. Receives tool name + input.",
        "codex": "pre_tool_call",
        "note": "Supported in Codex. Semantics are similar but blocking behavior may differ.",
    },
    "PostToolUse": {
        "claude": "Runs after a tool call completes. Receives tool name, input, and output.",
        "codex": "post_tool_call",
        "note": "Supported in Codex. Output injection may differ from Claude.",
    },
    "Notification": {
        "claude": "Triggered when Claude wants to send a user notification (e.g. task complete). Used for desktop alerts.",
        "codex": None,
        "note": "No Codex equivalent. Cannot be migrated automatically.",
    },
}


def resolve_path(template: str, home: Path, project: Path) -> Path:
    return Path(template.format(home=str(home), project=str(project)))


def all_entries() -> list[ConfigEntry]:
    return CLAUDE_ENTRIES + CODEX_ENTRIES


def claude_entries() -> list[ConfigEntry]:
    return CLAUDE_ENTRIES


def codex_entries() -> list[ConfigEntry]:
    return CODEX_ENTRIES
