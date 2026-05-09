"""
Reads and parses all Claude configuration files from local disk.
Returns structured data — no network calls.
"""

import json
import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Optional


@dataclass
class HookEntry:
    event: str
    matcher: str
    command: str


@dataclass
class SkillEntry:
    name: str
    description: str
    path: Path
    frontmatter: dict[str, Any]


@dataclass
class AgentEntry:
    name: str
    description: str
    tools: list[str]
    path: Path
    content_preview: str


@dataclass
class McpServer:
    name: str
    command: str
    args: list[str]
    env: dict[str, str]
    source_file: Path


@dataclass
class ClaudeConfig:
    # Global
    global_settings_path: Optional[Path] = None
    global_settings: dict[str, Any] = field(default_factory=dict)
    global_hooks: list[HookEntry] = field(default_factory=list)
    global_permissions_allow: list[str] = field(default_factory=list)
    global_permissions_deny: list[str] = field(default_factory=list)
    global_model: Optional[str] = None
    global_env: dict[str, str] = field(default_factory=dict)

    global_auth_path: Optional[Path] = None
    global_auth_present: bool = False

    global_skills_dir: Optional[Path] = None
    global_skills: list[SkillEntry] = field(default_factory=list)

    global_stop_hook_path: Optional[Path] = None
    global_stop_hook_present: bool = False

    # Project
    project_settings_path: Optional[Path] = None
    project_settings: dict[str, Any] = field(default_factory=dict)
    project_hooks: list[HookEntry] = field(default_factory=list)
    project_permissions_allow: list[str] = field(default_factory=list)
    project_permissions_deny: list[str] = field(default_factory=list)
    project_model: Optional[str] = None
    project_env: dict[str, str] = field(default_factory=dict)

    project_instructions_path: Optional[Path] = None
    project_instructions_preview: Optional[str] = None

    project_mcp_path: Optional[Path] = None
    project_mcp_servers: list[McpServer] = field(default_factory=list)

    project_hooks_dir: Optional[Path] = None
    project_hook_scripts: list[Path] = field(default_factory=list)

    project_agents_dir: Optional[Path] = None
    project_agents: list[AgentEntry] = field(default_factory=list)


def _load_json(path: Path) -> Optional[dict]:
    try:
        return json.loads(path.read_text())
    except Exception:
        return None


def _parse_hooks(settings: dict, scope_label: str) -> list[HookEntry]:
    hooks = []
    raw_hooks = settings.get("hooks", {})
    for event, entries in raw_hooks.items():
        if not isinstance(entries, list):
            continue
        for entry in entries:
            matcher = entry.get("matcher", "")
            for h in entry.get("hooks", []):
                if h.get("type") == "command":
                    hooks.append(HookEntry(
                        event=event,
                        matcher=matcher,
                        command=h.get("command", ""),
                    ))
    return hooks


def _parse_permissions(settings: dict) -> tuple[list[str], list[str]]:
    perms = settings.get("permissions", {})
    return perms.get("allow", []), perms.get("deny", [])


def _parse_skills(skills_dir: Path) -> list[SkillEntry]:
    skills = []
    if not skills_dir.is_dir():
        return skills
    for skill_path in sorted(skills_dir.iterdir()):
        if not skill_path.is_dir():
            continue
        skill_md = skill_path / "SKILL.md"
        if not skill_md.exists():
            continue
        content = skill_md.read_text()
        fm, _ = _parse_frontmatter(content)
        skills.append(SkillEntry(
            name=fm.get("name", skill_path.name),
            description=fm.get("description", ""),
            path=skill_md,
            frontmatter=fm,
        ))
    return skills


def _parse_agents(agents_dir: Path) -> list[AgentEntry]:
    agents = []
    if not agents_dir.is_dir():
        return agents
    for agent_file in sorted(agents_dir.glob("*.md")):
        content = agent_file.read_text()
        fm, body = _parse_frontmatter(content)
        preview = body.strip()[:200] + ("…" if len(body.strip()) > 200 else "")
        agents.append(AgentEntry(
            name=fm.get("name", agent_file.stem),
            description=fm.get("description", ""),
            tools=fm.get("tools", []),
            path=agent_file,
            content_preview=preview,
        ))
    return agents


def _parse_mcp(mcp_path: Path) -> list[McpServer]:
    servers = []
    data = _load_json(mcp_path)
    if not data:
        return servers
    for name, cfg in data.get("mcpServers", {}).items():
        servers.append(McpServer(
            name=name,
            command=cfg.get("command", ""),
            args=cfg.get("args", []),
            env=cfg.get("env", {}),
            source_file=mcp_path,
        ))
    return servers


def _parse_frontmatter(content: str) -> tuple[dict, str]:
    """Parse YAML-ish frontmatter (key: value only, no nested). Returns (fm_dict, body)."""
    fm: dict[str, Any] = {}
    if not content.startswith("---"):
        return fm, content
    parts = content.split("---", 2)
    if len(parts) < 3:
        return fm, content
    for line in parts[1].splitlines():
        if ":" in line:
            k, _, v = line.partition(":")
            k = k.strip()
            v = v.strip()
            if v.startswith("[") and v.endswith("]"):
                v = [x.strip().strip("'\"") for x in v[1:-1].split(",") if x.strip()]
            fm[k] = v
    return fm, parts[2]


def inspect(home: Optional[Path] = None, project: Optional[Path] = None) -> ClaudeConfig:
    """Read all Claude configs from disk and return a ClaudeConfig."""
    if home is None:
        home = Path.home()
    if project is None:
        project = Path.cwd()

    cfg = ClaudeConfig()

    # ── Global settings ──────────────────────────────────────────────────────
    gs_path = home / ".claude" / "settings.json"
    if gs_path.exists():
        cfg.global_settings_path = gs_path
        cfg.global_settings = _load_json(gs_path) or {}
        cfg.global_hooks = _parse_hooks(cfg.global_settings, "global")
        cfg.global_permissions_allow, cfg.global_permissions_deny = _parse_permissions(cfg.global_settings)
        cfg.global_model = cfg.global_settings.get("model")
        cfg.global_env = cfg.global_settings.get("env", {})

    # ── Global auth ──────────────────────────────────────────────────────────
    auth_path = home / ".claude.json"
    if auth_path.exists():
        cfg.global_auth_path = auth_path
        cfg.global_auth_present = True

    # ── Global skills ────────────────────────────────────────────────────────
    skills_dir = home / ".claude" / "skills"
    if skills_dir.exists():
        cfg.global_skills_dir = skills_dir
        cfg.global_skills = _parse_skills(skills_dir)

    # ── Global stop hook ─────────────────────────────────────────────────────
    stop_hook = home / ".claude" / "stop-hook-git-check.sh"
    if stop_hook.exists():
        cfg.global_stop_hook_path = stop_hook
        cfg.global_stop_hook_present = True

    # ── Project settings ─────────────────────────────────────────────────────
    ps_path = project / ".claude" / "settings.json"
    if ps_path.exists():
        cfg.project_settings_path = ps_path
        cfg.project_settings = _load_json(ps_path) or {}
        cfg.project_hooks = _parse_hooks(cfg.project_settings, "project")
        cfg.project_permissions_allow, cfg.project_permissions_deny = _parse_permissions(cfg.project_settings)
        cfg.project_model = cfg.project_settings.get("model")
        cfg.project_env = cfg.project_settings.get("env", {})

    # ── Project instructions ─────────────────────────────────────────────────
    claude_md = project / "CLAUDE.md"
    if claude_md.exists():
        cfg.project_instructions_path = claude_md
        text = claude_md.read_text()
        cfg.project_instructions_preview = text[:400] + ("…" if len(text) > 400 else "")

    # ── Project MCP ──────────────────────────────────────────────────────────
    mcp_path = project / ".mcp.json"
    if mcp_path.exists():
        cfg.project_mcp_path = mcp_path
        cfg.project_mcp_servers = _parse_mcp(mcp_path)

    # ── Project hooks directory ──────────────────────────────────────────────
    hooks_dir = project / ".claude" / "hooks"
    if hooks_dir.is_dir():
        cfg.project_hooks_dir = hooks_dir
        cfg.project_hook_scripts = sorted(hooks_dir.iterdir())

    # ── Project agents ───────────────────────────────────────────────────────
    agents_dir = project / ".claude" / "agents"
    if agents_dir.is_dir():
        cfg.project_agents_dir = agents_dir
        cfg.project_agents = _parse_agents(agents_dir)

    return cfg
