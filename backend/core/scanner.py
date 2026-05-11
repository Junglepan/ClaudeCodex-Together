"""
Scans local Claude artifacts that are eligible for sync.
Returns structured data — no writes.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Optional


@dataclass
class FrontMatter:
    data: dict[str, Any]
    body: str


def parse_frontmatter(content: str) -> FrontMatter:
    """Parse simple YAML-like frontmatter (key: value only, no nesting)."""
    data: dict[str, Any] = {}
    if not content.startswith("---"):
        return FrontMatter(data={}, body=content)
    parts = content.split("---", 2)
    if len(parts) < 3:
        return FrontMatter(data={}, body=content)
    for line in parts[1].splitlines():
        if ":" in line:
            k, _, v = line.partition(":")
            k, v = k.strip(), v.strip()
            if v.startswith("[") and v.endswith("]"):
                v = [x.strip().strip("'\"") for x in v[1:-1].split(",") if x.strip()]
            data[k] = v
    return FrontMatter(data=data, body=parts[2])


@dataclass
class SyncableSkill:
    name: str
    description: str
    source_path: Path
    content: str
    frontmatter: dict[str, Any]


@dataclass
class SyncableAgent:
    name: str
    description: str
    source_path: Path
    content: str
    frontmatter: dict[str, Any]


@dataclass
class SyncableInstructions:
    source_path: Path
    content: str
    has_slash_commands: bool
    has_tool_references: bool


@dataclass
class SyncableCommand:
    name: str
    source_path: Path
    content: str


@dataclass
class ScanResult:
    instructions: list[SyncableInstructions] = field(default_factory=list)
    skills: list[SyncableSkill] = field(default_factory=list)
    agents: list[SyncableAgent] = field(default_factory=list)
    commands: list[SyncableCommand] = field(default_factory=list)


# Patterns that are Claude-specific and need cleaning/flagging
SLASH_CMD_PATTERN = re.compile(r'/\w+')
CLAUDE_TOOL_REFS = [
    "use the Bash tool",
    "use the Read tool",
    "use the Write tool",
    "use the Edit tool",
    "use the TodoWrite",
    "the Bash tool",
    "the Read tool",
]


def scan_global(home: Optional[Path] = None) -> ScanResult:
    home = home or Path.home()
    result = ScanResult()

    # Instructions: ~/.claude/CLAUDE.md (rare but possible)
    global_claude_md = home / ".claude" / "CLAUDE.md"
    if global_claude_md.exists():
        content = global_claude_md.read_text()
        result.instructions.append(_make_instructions(global_claude_md, content))

    # Skills
    skills_dir = home / ".claude" / "skills"
    if skills_dir.is_dir():
        for skill_dir in sorted(skills_dir.iterdir()):
            if skill_dir.is_dir():
                skill_md = skill_dir / "SKILL.md"
                if skill_md.exists():
                    content = skill_md.read_text()
                    fm = parse_frontmatter(content)
                    result.skills.append(SyncableSkill(
                        name=fm.data.get("name", skill_dir.name),
                        description=str(fm.data.get("description", "")),
                        source_path=skill_md,
                        content=content,
                        frontmatter=fm.data,
                    ))

    # Agents: ~/.claude/agents/
    agents_dir = home / ".claude" / "agents"
    if agents_dir.is_dir():
        for agent_file in sorted(agents_dir.glob("*.md")):
            content = agent_file.read_text()
            fm = parse_frontmatter(content)
            result.agents.append(SyncableAgent(
                name=fm.data.get("name", agent_file.stem),
                description=str(fm.data.get("description", "")),
                source_path=agent_file,
                content=content,
                frontmatter=fm.data,
            ))

    # Commands: ~/.claude/commands/ (Codex has no equivalent)
    commands_dir = home / ".claude" / "commands"
    if commands_dir.is_dir():
        for cmd_file in sorted(commands_dir.glob("*.md")):
            result.commands.append(SyncableCommand(
                name=cmd_file.stem,
                source_path=cmd_file,
                content=cmd_file.read_text(),
            ))

    return result


def scan_project(project: Optional[Path] = None) -> ScanResult:
    project = project or Path.cwd()
    result = ScanResult()

    # Instructions: CLAUDE.md
    claude_md = project / "CLAUDE.md"
    if claude_md.exists():
        content = claude_md.read_text()
        result.instructions.append(_make_instructions(claude_md, content))

    # Skills (project-level)
    skills_dir = project / ".claude" / "skills"
    if skills_dir.is_dir():
        for skill_dir in sorted(skills_dir.iterdir()):
            if skill_dir.is_dir():
                skill_md = skill_dir / "SKILL.md"
                if skill_md.exists():
                    content = skill_md.read_text()
                    fm = parse_frontmatter(content)
                    result.skills.append(SyncableSkill(
                        name=fm.data.get("name", skill_dir.name),
                        description=str(fm.data.get("description", "")),
                        source_path=skill_md,
                        content=content,
                        frontmatter=fm.data,
                    ))

    # Agents
    agents_dir = project / ".claude" / "agents"
    if agents_dir.is_dir():
        for agent_file in sorted(agents_dir.glob("*.md")):
            content = agent_file.read_text()
            fm = parse_frontmatter(content)
            result.agents.append(SyncableAgent(
                name=fm.data.get("name", agent_file.stem),
                description=str(fm.data.get("description", "")),
                source_path=agent_file,
                content=content,
                frontmatter=fm.data,
            ))

    # Commands: .claude/commands/ (Codex has no equivalent)
    commands_dir = project / ".claude" / "commands"
    if commands_dir.is_dir():
        for cmd_file in sorted(commands_dir.glob("*.md")):
            result.commands.append(SyncableCommand(
                name=cmd_file.stem,
                source_path=cmd_file,
                content=cmd_file.read_text(),
            ))

    return result


def _make_instructions(path: Path, content: str) -> SyncableInstructions:
    has_slash = bool(SLASH_CMD_PATTERN.search(content))
    has_tool = any(ref.lower() in content.lower() for ref in CLAUDE_TOOL_REFS)
    return SyncableInstructions(
        source_path=path,
        content=content,
        has_slash_commands=has_slash,
        has_tool_references=has_tool,
    )
