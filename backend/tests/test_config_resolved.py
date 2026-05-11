import sys
import json
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from api.routers.config import _resolve_claude, _resolve_codex


class ResolvedConfigTests(unittest.TestCase):
    def test_claude_array_settings_merge_across_layers(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            home = root / "home"
            project = root / "project"
            (home / ".claude").mkdir(parents=True)
            (project / ".claude").mkdir(parents=True)

            (home / ".claude" / "settings.json").write_text(
                json.dumps({
                    "hooks": [{"event": "global"}],
                    "permissions": ["Read"],
                    "model": "global-model",
                }),
                encoding="utf-8",
            )
            (project / ".claude" / "settings.json").write_text(
                json.dumps({
                    "hooks": [{"event": "project"}],
                    "permissions": ["Write"],
                    "model": "project-model",
                }),
                encoding="utf-8",
            )
            (project / ".claude" / "settings.local.json").write_text(
                json.dumps({
                    "hooks": [{"event": "local"}],
                    "permissions": ["Bash"],
                }),
                encoding="utf-8",
            )

            resolved = _resolve_claude(home, project)
            rows = {row["key"]: row for row in resolved["settings"]}

            self.assertEqual(rows["hooks"]["source"], "merged")
            self.assertEqual(
                json.loads(rows["hooks"]["value"]),
                [{"event": "global"}, {"event": "project"}, {"event": "local"}],
            )
            self.assertEqual(rows["permissions"]["source"], "merged")
            self.assertEqual(json.loads(rows["permissions"]["value"]), ["Read", "Write", "Bash"])
            self.assertEqual(rows["model"]["source"], "project")
            self.assertEqual(rows["model"]["overrides"], ["global"])

    def test_codex_agents_are_resolved_from_toml_files(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            home = root / "home"
            project = root / "project"
            (home / ".codex" / "agents").mkdir(parents=True)
            (project / ".codex" / "agents").mkdir(parents=True)

            (home / ".codex" / "agents" / "reviewer.toml").write_text("name = 'reviewer'\n", encoding="utf-8")
            (project / ".codex" / "agents" / "planner.toml").write_text("name = 'planner'\n", encoding="utf-8")

            resolved = _resolve_codex(home, project)
            agents = {(item["name"], item["source"]) for item in resolved["agents"]}

            self.assertEqual(agents, {("reviewer", "global"), ("planner", "project")})


if __name__ == "__main__":
    unittest.main()
