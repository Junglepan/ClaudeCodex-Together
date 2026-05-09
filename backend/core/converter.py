"""
Pure conversion functions: Claude artifact → Codex artifact.
No file I/O — takes content, returns converted content + metadata.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any

from .scanner import SyncableSkill, SyncableAgent, SyncableInstructions

# Claude-specific slash commands to remove
SLASH_CMDS_TO_REMOVE = {
    "/compact", "/clear", "/help", "/reset", "/model",
    "/cost", "/tokens", "/memory", "/vim",
}

SLASH_CMD_RE = re.compile(r'`?(/\w+)`?(?:\s[^\n]*)?')


@dataclass
class ConversionResult:
    content: str
    status: str          # "added" | "check" | "not_added"
    notes: str
    warnings: list[str]


def convert_instructions(inst: SyncableInstructions) -> ConversionResult:
    """Convert CLAUDE.md content to AGENTS.md format."""
    content = inst.content
    warnings: list[str] = []
    needs_check = False

    # Remove lines that only reference slash commands
    if inst.has_slash_commands:
        cleaned_lines = []
        for line in content.splitlines():
            # Check if the line is primarily a slash command reference
            stripped = line.strip()
            is_slash_only = any(
                stripped.startswith(cmd) or f" {cmd}" in stripped
                for cmd in SLASH_CMDS_TO_REMOVE
            )
            if is_slash_only:
                warnings.append(f"Removed Claude slash command reference: {stripped[:60]}")
                needs_check = True
            else:
                cleaned_lines.append(line)
        content = "\n".join(cleaned_lines)

    if inst.has_tool_references:
        warnings.append("Contains Claude tool name references — review before using in Codex")
        needs_check = True

    status = "check" if needs_check else "added"
    notes = (
        "Converted to AGENTS.md; contains Claude tool references — review before using"
        if inst.has_tool_references
        else "Converted to AGENTS.md" if not needs_check
        else "Converted to AGENTS.md; Claude slash command references removed"
    )

    return ConversionResult(content=content, status=status, notes=notes, warnings=warnings)


def convert_skill(skill: SyncableSkill) -> ConversionResult:
    """Convert Claude SKILL.md to Codex skill .md format."""
    fm = skill.frontmatter
    _, _, body = skill.content.partition("---")
    if body.startswith("\n"):
        _, _, body = body.partition("\n")
    _, _, body = body.partition("---")
    body = body.lstrip("\n")

    # Build new frontmatter (Codex format is the same, just ensure required fields)
    name = fm.get("name", skill.source_path.parent.name)
    description = fm.get("description", "")

    new_fm = f"---\nname: {name}\ndescription: {description}\n---\n"
    content = new_fm + body

    has_tool_refs = any(
        ref.lower() in body.lower()
        for ref in ["use the Bash tool", "use the Read tool", "use the Write tool"]
    )

    status = "check" if has_tool_refs else "added"
    notes = (
        "Converted into a Codex skill; contains Claude tool references — review before using"
        if has_tool_refs
        else "Converted into a Codex skill"
    )

    return ConversionResult(content=content, status=status, notes=notes, warnings=[])


def convert_agent(agent: SyncableAgent) -> ConversionResult:
    """Convert Claude agent .md to Codex agent .md format."""
    fm = agent.frontmatter
    _, _, body = agent.content.partition("---")
    if body.startswith("\n"):
        _, _, body = body.partition("\n")
    _, _, body = body.partition("---")
    body = body.lstrip("\n")

    name = fm.get("name", agent.source_path.stem)
    description = fm.get("description", "")

    # tools list: Claude tools (Read, Write, Bash...) → note in Codex, keep as comment
    tools = fm.get("tools", [])
    tools_note = ""
    if tools:
        tools_note = f"# tools (Claude): {', '.join(tools) if isinstance(tools, list) else tools}\n"

    new_fm = f"---\nname: {name}\ndescription: {description}\n---\n"
    content = new_fm + tools_note + body

    status = "check" if tools else "added"
    notes = (
        "Added as a Codex subagent; tool list preserved as comment — verify Codex tool names"
        if tools
        else "Added as a Codex subagent"
    )

    return ConversionResult(content=content, status=status, notes=notes, warnings=[])
