"""
Abstract base class for all agent definitions.
Adding a new agent: subclass AgentBase, implement all abstract methods,
then call registry.register(MyAgent()) in core/agents/registry.py.
"""

from __future__ import annotations

import os
import platform
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional


@dataclass
class ConfigFileSpec:
    key: str
    label: str
    path_template: str          # {home} and {project} placeholders
    scope: str                  # "global" | "project"
    kind: str                   # "file" | "dir"
    format: str                 # "json" | "toml" | "markdown" | "shell" | "dir"
    purpose: str
    details: str
    counterpart_agent: Optional[str] = None
    counterpart_key: Optional[str] = None
    sync_strategy: Optional[str] = None


@dataclass
class ConfigFileResult:
    key: str
    label: str
    path: str
    exists: bool
    scope: str
    kind: str
    format: str
    status: str                 # "active" | "optional" | "available" | "missing"
    size_bytes: Optional[int] = None
    modified_at: Optional[str] = None
    purpose: str = ""
    details: str = ""
    counterpart_agent: Optional[str] = None
    counterpart_key: Optional[str] = None
    sync_strategy: Optional[str] = None


@dataclass
class AgentSummary:
    id: str
    name: str
    status: str                 # "active" | "not_installed" | "partial"
    global_path: str
    file_count: int


class AgentBase(ABC):
    @property
    @abstractmethod
    def id(self) -> str: ...

    @property
    @abstractmethod
    def name(self) -> str: ...

    @property
    @abstractmethod
    def global_dir_template(self) -> str:
        """Template using {home}. E.g. '{home}/.claude'"""
        ...

    @property
    @abstractmethod
    def config_file_specs(self) -> list[ConfigFileSpec]: ...

    # ── Path resolution ───────────────────────────────────────────────────────

    @staticmethod
    def _home() -> Path:
        return Path.home()

    @staticmethod
    def _default_project() -> Path:
        """Project root: prefer CC_STEWARD_PROJECT (or legacy CCT_PROJECT) env var, else parent of backend dir."""
        import os
        env = os.environ.get("CC_STEWARD_PROJECT") or os.environ.get("CCT_PROJECT")
        if env:
            return Path(env)
        return Path(__file__).parent.parent.parent

    def resolve_path(self, template: str, project: Optional[Path] = None) -> Path:
        home = str(self._home())
        proj = str(project or self._default_project())
        return Path(template.format(home=home, project=proj))

    def global_dir(self) -> Path:
        return self.resolve_path(self.global_dir_template)

    # ── File scanning ─────────────────────────────────────────────────────────

    def scan_files(self, project: Optional[Path] = None) -> list[ConfigFileResult]:
        results = []
        for spec in self.config_file_specs:
            p = self.resolve_path(spec.path_template, project)
            exists = p.exists()
            size = p.stat().st_size if exists and p.is_file() else None
            mtime = None
            if exists and p.is_file():
                import datetime
                mtime = datetime.datetime.fromtimestamp(p.stat().st_mtime).isoformat(timespec='seconds')

            status = self._infer_status(spec, exists)

            results.append(ConfigFileResult(
                key=spec.key,
                label=spec.label,
                path=str(p),
                exists=exists,
                scope=spec.scope,
                kind=spec.kind,
                format=spec.format,
                status=status,
                size_bytes=size,
                modified_at=mtime,
                purpose=spec.purpose,
                details=spec.details,
                counterpart_agent=spec.counterpart_agent,
                counterpart_key=spec.counterpart_key,
                sync_strategy=spec.sync_strategy,
            ))
        return results

    def _infer_status(self, spec: ConfigFileSpec, exists: bool) -> str:
        if not exists:
            return "missing"
        # Subclasses can override for more nuanced status
        key = spec.key
        if "settings" in key or "instructions" in key or "stop_hook" in key:
            return "active"
        if spec.scope == "global":
            return "active" if exists else "optional"
        return "available"

    def summary(self, project: Optional[Path] = None) -> AgentSummary:
        files = self.scan_files(project)
        existing = [f for f in files if f.exists]
        if not existing:
            status = "not_installed"
        elif len(existing) == len(files):
            status = "active"
        else:
            status = "partial"
        return AgentSummary(
            id=self.id,
            name=self.name,
            status=status,
            global_path=str(self.global_dir()),
            file_count=len(existing),
        )

    def get_file(self, key: str, project: Optional[Path] = None) -> Optional[ConfigFileResult]:
        return next((f for f in self.scan_files(project) if f.key == key), None)

    def read_file_content(self, key: str, project: Optional[Path] = None) -> Optional[str]:
        file = self.get_file(key, project)
        if not file or not file.exists or file.kind == "dir":
            return None
        try:
            return Path(file.path).read_text(encoding="utf-8")
        except Exception:
            return None
