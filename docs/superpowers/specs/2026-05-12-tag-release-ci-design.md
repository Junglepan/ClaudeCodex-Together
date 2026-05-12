# Tag Release CI Design

## Goal

Create a reliable GitHub Actions release pipeline that publishes packaged desktop installers when a `v*` git tag is pushed.

## Scope

The release workflow builds unsigned macOS, Windows, and Linux packages, uploads build artifacts, and creates a GitHub Release containing those artifacts.

Out of scope: Apple Developer ID signing, notarization, Windows code signing, auto-update publishing, package manager distribution, and version bump automation.

## Trigger

The official release path is a pushed git tag matching `v*`, such as `v1.0.1`. The workflow also supports manual `workflow_dispatch` reruns for maintainers, but release discipline should remain tag based.

## Release Checks

Each platform build must run these checks before packaging:

- `npm ci`
- `npm run type-check`
- `npm run build:frontend`
- `npm run check:file-assets`
- `npm run build:electron`
- Python dependency installation for the backend
- `python -m pytest backend/tests`

The `check:file-assets` step prevents regressions where packaged Electron loads a blank client because renderer assets, routing, or backend packaging are incompatible with `file://` and `app.asar`.

## Artifacts

The matrix builds:

- macOS: `.dmg` and `.zip`
- Windows: `.exe`
- Linux: `.AppImage`

Artifact upload should fail when no package is produced for a matrix entry.

## GitHub Release

A final release job downloads all matrix artifacts and uses `softprops/action-gh-release` to create or update the GitHub Release for the tag. Release notes are generated automatically.

## Constraints

The workflow uses the built-in `GITHUB_TOKEN`. No signing secrets are required. The resulting installers are unsigned until signing is added later.
