# cc-steward Post-Release Gap Closure Design

Date: 2026-05-15

## Scope

This work closes the release gaps found after `v1.1.0`. It is a stabilization batch, not a full ROADMAP completion pass.

In scope:

- Sync Center data correctness and execution semantics.
- Overview health judgment for global and project instruction alignment.
- Project context consistency while keeping `~` as the default project when no explicit project is provided.
- Electron integration gaps that affect already advertised behavior.
- ROADMAP status cleanup for items that are already complete or completed by this batch.

Out of scope:

- System tray support.
- Auto-update support.
- Full ROADMAP implementation.
- Broad redesign of Settings, Help, or file detail pages.
- Changing the product decision that no explicit project falls back to `~`.

## Product Decisions

When no `CC_STEWARD_PROJECT` or legacy `CCT_PROJECT` environment variable is present, cc-steward uses the user home directory as the current project context. UI copy and types should treat this as a valid current project, not as an empty project selection.

This batch should make existing claims true rather than add speculative features. If a planned item requires deeper product design, it remains in the roadmap instead of being partially implemented.

## Module 1: Sync Center

The Sync Center already presents a four-stage flow: scan, plan, dry-run, execute. The backend must make those stages semantically distinct and actionable.

Expected behavior:

- `sync.scan` returns discovered Claude-side items with source metadata only.
- `sync.plan` adds target paths, migration status, notes, warnings, and conflict status.
- `sync.dryRun` reports the per-item action the executor would take: `would_write`, `would_skip`, `would_overwrite`, or `skip_unsupported`.
- `sync.execute` returns actual writes, skips, overwrites, backups, and errors.
- If replace/overwrite mode is enabled, existing target files are backed up before being overwritten.
- Unsupported items such as Claude commands remain visible but are never written.

Codex agent migration must align with the rest of the app. Since resolved Codex agents are scanned as `.toml`, migrated Codex agents should be written in `.toml` form or the resolved scanner and definitions must be changed together. The preferred design is to output `.toml` Codex agent files so Sync Center and resolved config agree.

Warnings should be useful but bounded:

- Instruction content containing Claude slash-command references is marked for review.
- Claude agent `tools` metadata is preserved as explicit metadata/commentary in the target format and marked for review if needed.
- Unsupported command migration explains that Codex has no equivalent slash-command mechanism.

## Module 2: Overview Health

Overview should answer whether the visible Claude and Codex configuration is healthy and aligned.

Global health checks:

- Claude global settings: `~/.claude/settings.json`.
- Claude global instructions: `~/.claude/CLAUDE.md`.
- Codex global config: `~/.codex/config.toml`.
- Codex global instructions: `~/.codex/AGENTS.md`.

Project health checks, using the current project path, including `~` when it is the default:

- `CLAUDE.md` and `AGENTS.md` are treated as paired instruction files.
- If one exists and the other is missing, the card and comparison table should show an unsynced state.
- Missing optional directories such as agents, skills, commands, and memories should be displayed but should not by themselves make the whole card unhealthy.

The warning copy should describe the concrete issue, for example "项目 AGENTS.md 未同步" instead of only "关键配置文件未找到".

## Module 3: Project Context

The app should consistently treat project context as `string | undefined`, where `undefined` means "not loaded yet" and a string is the active project path. After metadata loads, the active project should be either the environment-provided path or `homeDir()`.

Implementation requirements:

- Keep `/meta` returning home as `project_path` when no explicit project is set.
- Update stale version reporting so `health.version` matches the app version instead of a hard-coded old value.
- Ensure UI copy does not suggest "no project selected" after the metadata call has assigned `~`.
- Preserve recent-project behavior when the current project is switched through the TitleBar or native menu.

## Module 4: Electron Integration

Only high-value integration gaps are in scope.

File watching:

- Watch global config files and relevant global config directories.
- Watch current project instruction files and relevant project config directories.
- Include agent, skill, command, and Codex configuration directories so external edits and newly added files refresh the UI.
- Keep the watcher scoped; do not recursively watch the entire home directory.
- Continue debouncing renderer refreshes to avoid toast spam and repeated reloads.

Menu integration:

- Add native menu actions that are already supported by renderer state or simple shell actions.
- In scope: toggle theme, navigate to GitHub, existing refresh/sidebar/navigation behavior.
- Out of scope for this batch: system tray and automatic update.

If "export current config" requires a larger file-selection workflow than the existing backup export supports, leave it in the roadmap.

## Module 5: ROADMAP Status

Update `docs/ROADMAP.md` after implementation so it reflects reality.

Rules:

- Mark only verified work as complete.
- Leave unrelated planned features untouched.
- If an item is partially done, split it or mark it as in progress with a note.
- Do not mark the whole roadmap complete because this batch is intentionally scoped.

## Testing Strategy

Use test-driven development for behavior changes.

Backend tests:

- Sync dry-run identifies write, skip, overwrite, unsupported, and backup behavior.
- Sync execute creates backups before overwrite.
- Codex agent migration output matches the resolved config scanner's expected format.
- Health metadata version is not stale.

Frontend or focused unit tests where practical:

- Overview classifies paired instruction files as aligned, migratable, pending import, or unconfigured.
- Project context copy treats `~` as an active project after metadata loads.

Verification commands:

```bash
npm run type-check
npm run test:backend
npm run build:electron
```

If frontend layout changes materially, run the app and visually inspect Overview and Sync Center in Electron or the in-app browser.

## Risks

The main risk is sync overwrite behavior because it writes user configuration files. Mitigation: dry-run must expose intended actions, execute must back up before overwrite, and tests must cover existing-target cases.

The second risk is format mismatch for Codex agents. Mitigation: choose one target format and test both migration output and resolved scanning against it.

The third risk is watcher scope creep. Mitigation: watch only known config paths and directories, never the whole home directory.
