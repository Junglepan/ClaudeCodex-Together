import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from api.routers.projects import _discover_from_codex, _merge
from main import meta


class ProjectsAndMetaTests(unittest.TestCase):
    def test_meta_keeps_project_path_unset_without_env_override(self):
        with patch.dict(os.environ, {"CC_STEWARD_PROJECT": "", "CCT_PROJECT": ""}, clear=False):
            os.environ.pop("CC_STEWARD_PROJECT", None)
            os.environ.pop("CCT_PROJECT", None)

            result = meta()

            self.assertIsNone(result["project_path"])

    def test_merge_preserves_latest_last_used_and_sorts_recent_first(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            older = root / "older"
            newer = root / "newer"
            shared = root / "shared"
            older.mkdir()
            newer.mkdir()
            shared.mkdir()

            merged = _merge(
                [
                    {"path": str(older), "name": "older", "exists": True, "source": "codex", "last_used": None},
                    {"path": str(shared), "name": "shared", "exists": True, "source": "codex", "last_used": None},
                ],
                [
                    {"path": str(newer), "name": "newer", "exists": True, "source": "claude", "last_used": 200.0},
                    {"path": str(shared), "name": "shared", "exists": True, "source": "claude", "last_used": 100.0},
                ],
            )

            self.assertEqual([item["name"] for item in merged], ["newer", "shared", "older"])
            self.assertEqual(merged[1]["source"], "both")
            self.assertEqual(merged[1]["last_used"], 100.0)
            self.assertIsNone(merged[2]["last_used"])

    def test_discover_from_codex_returns_projects_without_toml_dependency(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            home = root / "home"
            project = root / "project"
            (home / ".codex").mkdir(parents=True)
            project.mkdir()
            (home / ".codex" / "config.toml").write_text(
                f'[projects."{project}"]\ntrust_level = "trusted"\n',
                encoding="utf-8",
            )

            result = _discover_from_codex(home)

            self.assertEqual(
                result,
                [{
                    "path": str(project),
                    "name": "project",
                    "exists": True,
                    "source": "codex",
                    "last_used": None,
                }],
            )


if __name__ == "__main__":
    unittest.main()
