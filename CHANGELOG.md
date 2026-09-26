# Changelog

All notable changes to **Recent by Remote** are documented in this file.

## 1.0.1 — 2026-09-27

Documentation only — no code changes.

### Changed

- README: corrected the Remote Explorer comparison. Remote Explorer's per-host folders come from separate histories kept by Remote - SSH / Remote - Tunnels (not the Recently Opened list), and they can be removed one at a time via **Remove from Recent List**.
- README: added a known limitation — removing an entry here does not remove the same folder from Remote Explorer's per-provider histories.
- README: documented the Marketplace publish steps in the maintainer release flow.

## 1.0.0 — 2026-05-24

First stable release.

### Added

- **Remote Explorer comparison** in the README — explains how Recent by Remote complements the built-in view (Targets vs. Recently Opened).
- **Dev Container authority form awareness** — the extension now decodes both authority payload shapes used by the current Dev Containers extension:
  - **JSON form** (`configFile` / `localDocker` / `settings` present): the `devcontainer.json` path is surfaced in the row description and tooltip.
  - **Raw host path form** (no payload): shown as `(no config recorded)`.
  Within the same `hostPath` sub-group, entries with a config payload are sorted above entries without one.
- **`Recent by Remote: Dump Recently Opened (raw JSON)`** command — opens an editor with the raw `_workbench.getRecentlyOpened` result and the decoded Dev Container authority payload inline. Intended for debugging and support tickets.

### Security

- Resolved 5 `pnpm audit` advisories (3 high, 2 moderate) by bumping `esbuild` to `^0.25.0` and pinning the transitive `serialize-javascript` (>=7.0.5) and `fast-uri` (>=3.1.2) via `pnpm.overrides`.

### Changed

- README restructured: Features split into sub-categories, "Release flow" moved to the end (maintainer-only), `.vsix` install step links to the Releases page, Marketplace / Installs / License badges added.

## 0.0.8 — 2026-05-11

- Added `Ctrl+Enter` / `Cmd+Enter` keybinding to open the selected entry in a new window.
- Added `recentByRemote.clickAction` setting (`openHere` / `openInNewWindow`).

## 0.0.7 and earlier

See [GitHub Releases](https://github.com/kyanet/vscode-recent-by-remote/releases) for the changes in earlier versions.
