"""
Backend agent registry.
To add a new agent: import its class and call registry.register(MyAgent()).
"""

from typing import Optional
from .base import AgentBase
from .claude import ClaudeAgent
from .codex import CodexAgent


class AgentRegistry:
    def __init__(self):
        self._agents: dict[str, AgentBase] = {}

    def register(self, agent: AgentBase):
        self._agents[agent.id] = agent

    def get(self, agent_id: str) -> Optional[AgentBase]:
        return self._agents.get(agent_id)

    def all(self) -> list[AgentBase]:
        return list(self._agents.values())

    def ids(self) -> list[str]:
        return list(self._agents.keys())


registry = AgentRegistry()
registry.register(ClaudeAgent())
registry.register(CodexAgent())
