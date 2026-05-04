# Recent by Remote

**English** | [日本語](#日本語)

A VS Code extension that **groups your "Open Recent" history by remote route** and lets you triage / delete unwanted entries from a Tree View.

## Overview

VS Code's official Quick Pick (`Ctrl+R`) lists every Remote-hosted entry with similar-looking labels, making it hard to tell Tunnel / WSL / Dev Container / SSH apart. When you've opened the same folder over multiple routes, it becomes nearly impossible to clean up by hand.

This extension consumes the official Recently Opened list as-is and adds a route-grouped Tree View to the Activity Bar. It does **not** maintain its own history — it only provides display and delete operations on top of the official data.

Because the tree is split per route, it's also useful for **finding and bulk-cleaning entries from routes you no longer use** (decommissioned tunnel hosts, stopped SSH machines, leftover `\\wsl.localhost\<distro>\...` entries from removed dev containers, etc.). Each row's trash icon removes the entry from the official Recently Opened list directly.

## Supported Platforms

Works on **Windows / macOS / Linux**. The **WSL** route group only appears on Windows (WSL is a Windows-only feature). Dev Containers on macOS / Linux record their `hostPath` in POSIX form (`/Users/...` or `/home/...`), so they are classified under `Local > Dev Container`.

## Before / After

### Before — VS Code's stock Open Recent

![Standard VS Code Open Recent menu, where multiple entries labeled "[Dev Container]" provide no clue as to which underlying route they were reached via](https://raw.githubusercontent.com/kyanet/vscode-recent-by-remote/main/resources/screenshots/before-open-recent.png)

Multiple `[Dev Container]` entries in a row give no indication of whether each one was reached via **WSL / Tunnel / SSH**. The route information is missing, so it's easy to confuse multiple entries that share the same devcontainer name. Direct entries like `[WSL: distro]` and `[SSH: ip]` do indicate the route, but cram folder name and route into a single line, making it visually busy.

### After — Recent by Remote

![Tree view organized by remote type. Each top-level node is a route (Tunnel/WSL/SSH), with direct entries first and a Dev Container sub-group at the bottom showing the count of containers reached via that route.](https://raw.githubusercontent.com/kyanet/vscode-recent-by-remote/main/resources/screenshots/after-tree-view.png)

The tree is split per route, with the `Dev Container` sub-group **placed at the end of each parent route**, so "dev container via Tunnel" / "via WSL" / "via SSH" can all be told apart at a glance. Even when in-container paths collide at `/workspaces/myProject1`, the structure tells you which route the container is running on. A `(connect, no folder)` pseudo-entry is auto-added to each route, so you always have a one-click path to start a bare session on that remote without opening any folder.

## Features

- **Route-based grouping**: Auto-classifies entries into Tunnel / WSL / SSH / Local / Other. Each header gets a representative icon (`radio-tower` / `terminal-linux` / `key` / `device-desktop` / `question`)
- **Per-host headers**: Further splits by host into `Tunnel (myhost)`, `WSL (Ubuntu)`, `SSH (myserver)`
- **Dev Containers nested under their parent route**: Dev Containers don't form a top-level route group — they're nested as a `Dev Container` sub-group (`package` icon, item-count description like `3 items`) under the parent host route (e.g. `Tunnel (myhost)`, `WSL (Ubuntu)`, `Local`). This makes it visually clear which route each container is running on
- **Direct entries first, Dev Container sub-group last**: Within each route group, direct folders / workspaces / `(connect, no folder)` come first, with the `Dev Container` sub-group at the bottom. This visually separates direct opens from container-internal opens, so identically-named folders (e.g. `myProject1 /home/user/myProject1` directly under WSL vs. the same name inside a Dev Container at `\\wsl.localhost\<distro>\home\user\myProject1`) are easy to tell apart
- **Per-hostPath sub-grouping inside Dev Container**: When the same devcontainer definition is opened from multiple subfolders, the entries are collapsed into a single node by `hostPath` (the host-side project folder embedded in the authority — `package` icon, visually consistent with the Dev Container sub-group). Containers that collide at the in-container path `/workspace` are still distinguishable by their host-side project name
- **Theme-aware tooltip badges**: On hover, entry kind / type / parent route (for Dev Containers) are rendered as badges that follow VS Code theme colors (`--vscode-charts-*` / `--vscode-badge-*`). Visible in both Dark and Light themes. Full `uri` / `host` / `path` info is included
- **Connect-only entries**: Each Tunnel / WSL / SSH route gets an auto-added `(connect, no folder)` pseudo-entry. One-click connect-without-folder. Even when only Dev Container entries remain on a route (e.g. `WSL (distro-X)` only has dev container history), the parent route is reverse-derived from the authority so `(connect, no folder)` is still surfaced — guaranteeing a path back to a bare session on that distro
- **Folders, workspaces, and files in one view**: The view shows recent folders, workspaces, **and recent files** (distinguishable by icon)
- **Project-root-relative file display**: When an in-container `fullPath` lives under `hostPath`, the description is shortened to the relative path. For non-standard mount layouts where the in-container absolute path differs, the absolute path is shown instead
- **Group mode toggle**: Title bar icon toggles between "Group by Remote only (mixed types)" and "Two-tier: Type → Remote (Workspaces & Folders / Files separated)". Choice is persisted globally
- **Per-entry deletion**: Trash icon next to each entry removes it from the official Recently Opened list
- **One-click open with VS Code's native window routing**: Clicks open the entry with the same routing as the official Open Recent — focuses an existing window with the matching authority, otherwise spawns a new window resolving the authority
- **Open in new window**: Available via the `$(empty-window)` row-hover button, "Open in New Window" right-click menu, or the item button in the Quick Pick
- **Quick Pick command**: `Recent by Remote: Open...` from the command palette searches all entries with route prefixes

### Tree structure

Each route group is laid out as "direct entries → Dev Container sub-group at the end".

```
Recent by Remote: Recently Opened
├─ Tunnel (name)                                          ← route group (radio-tower)
│  ├─ myProject1         /home/user/myProject1            ← direct entry (folder-opened)
│  ├─ devcontainer.json  /home/user/myProject1/.devcontainer
│  ├─ (connect, no folder)                                ← connect-only entry (plug)
│  └─ Dev Container                1 item                 ← collapsed at end (package)
│      └─ myProject1     /home/user/myProject1            ← hostPath sub-group (package)
│          └─ myProject1 /workspaces/myProject1
├─ WSL (distro)                                           (terminal-linux)
│  ├─ myProject1         /home/user/myProject1            ← direct WSL folder
│  ├─ myProject2         /home/user/myProject2
│  ├─ (connect, no folder)
│  └─ Dev Container                1 item
│      └─ myProject1     \\wsl.localhost\distro\home\user\myProject1
│          └─ myProject1 /workspaces/myProject1
├─ SSH (IP address)                                       (key)
│  ├─ myProject2         /home/user/myProject2
│  ├─ myProject1         /home/user/myProject1
│  ├─ user               /home/user
│  ├─ (connect, no folder)
│  └─ Dev Container                2 items
│      └─ myProject1     /home/user/myProject1
│          ├─ myProject1        /workspaces/myProject1
│          └─ devcontainer.json /workspaces/myProject1/.devcontainer
└─ Local                                                  (device-desktop)
   └─ ...
```

The `1 item` / `2 items` text on `Dev Container` rows is rendered as the TreeItem `description` (dimmed). The `HostPathGroupNode` always uses the `package` icon today because the only source of `hostPath` is Dev Container authorities (the `repo` icon is reserved for future cases where non-Dev-Container entries provide a `hostPath`).

## Install

### From the Marketplace

Search for `Recent by Remote` in the Extensions view and install. The Marketplace ID is `kyanet.recent-by-remote`.

### From a `.vsix`

Download the `.vsix` from the Releases page, then in the Extensions view choose the `...` menu → **Install from VSIX...**.

### Build from source

```bash
pnpm install
pnpm run vsix
```

`pnpm run vsix` runs the production build (type check + lint + esbuild) and outputs `recent-by-remote-<version>.vsix`. Install it via the VSIX procedure above.

## Release flow

A tag push triggers a GitHub Actions workflow that builds the `.vsix` and attaches it to a GitHub Release. Maintainer steps:

```bash
pnpm version patch    # patch / minor / major. Updates package.json and creates a git tag
git push --follow-tags
```

When a `v*` tag is pushed, [.github/workflows/release.yml](.github/workflows/release.yml) runs:

1. Verifies the tag version matches `package.json`
2. Builds the `.vsix` via `pnpm run vsix`
3. Creates a GitHub Release with the `.vsix` attached (release notes auto-generated from commits since the previous tag)

Marketplace publishing is currently manual via `vsce publish`.

## Usage

1. After enabling the extension, a history icon (`$(history)`) appears in the Activity Bar
2. Clicking it opens the **Recent by Remote: Recently Opened** view
3. Recently Opened entries are listed grouped by route
4. Per-entry actions:
   - **Click row**: Opens with the same routing as the official Open Recent — focuses a matching-authority window if it exists, otherwise spawns a new one
   - **Open in New Window button** (`$(empty-window)`): Opens in a new window (Ctrl+Click equivalent)
   - **Remove button** (`$(trash)`): Removes from the official Recently Opened list
   - **Right-click menu**: Provides "Open" / "Open in New Window" / "Remove from Recent"
   - **`(connect, no folder)` entry**: Opens an empty window connected to that authority (no folder)
5. The `Recent by Remote: Open...` Quick Pick also has a `$(empty-window)` button on each item to open in a new window
6. Refresh via the title-bar refresh button or the `Recent by Remote: Refresh` command

### Commands

| Command | Description |
|---|---|
| `Recent by Remote: Refresh` | Reloads the Tree View |
| `Recent by Remote: Open...` | Picks an entry from a Quick Pick of all entries |
| `Recent by Remote: Group by Type (Workspaces / Files)` | Switches to two-tier (type → route) grouping |
| `Recent by Remote: Group by Remote Only` | Switches to single-tier (route only) grouping |
| `Recent by Remote: Toggle Group Mode` | Toggles the two modes (intended for keybinding) |

## Classification logic

Each entry is classified using the `remoteAuthority` field returned by the internal API `_workbench.getRecentlyOpened`.

| Group | Match |
|---|---|
| Local | no `remoteAuthority` |
| WSL | starts with `wsl+<distro>` |
| Tunnel | starts with `tunnel+<host>` |
| SSH | starts with `ssh-remote+<host>` |
| Dev Container | `dev-container+<hex>` or `attached-container+<hex>` |
| Other | anything else |

### Dev Container parent route detection

Dev Container entries (authorities starting with `dev-container+<hex>` or `attached-container+<hex>`) are placed under a `Dev Container` sub-group inside their parent host route. The extension decodes the authority hex (JSON) and the trailing `@<auth>` suffix to determine the parent:

| hostPath / suffix | Parent group |
|---|---|
| Suffix `@tunnel+myhost` | `Tunnel (myhost)` |
| Suffix `@wsl+ubuntu` | `WSL (Ubuntu)` |
| Suffix `@ssh-remote+myserver` | `SSH (myserver)` |
| `hostPath = \\wsl.localhost\Ubuntu\...` (no suffix) | `WSL (Ubuntu)` *1 |
| `hostPath = C:\...` (no suffix) | `Local` |
| `hostPath = /home/...` (no suffix) | `Local` |

*1 The official Dev Containers extension is fixed at `extensionKind: ["ui"]`, so even Dev Containers opened from a WSL session record `hostPath` in Windows-side UNC form (see next section). This extension extracts the WSL distro name from the UNC and nests the entry under the matching `WSL (<distro>)` group.

Inside the Dev Container sub-group, entries are further sub-grouped by `hostPath` (host-side project folder). Even when the same devcontainer definition has multiple histories from root and subfolder opens, they're collapsed into a single node (`package` icon). The sub-group label uses the basename of the host-side folder, so multiple Dev Containers that collide at in-container path `/workspace` are still distinguishable by the host-side project name.

### Dev Containers extension always runs on the Windows VS Code side (UI extension)

> **Note**: The following section describes **Windows + WSL specific behavior**. On macOS / Linux, the Dev Containers extension also runs on the UI side, but `hostPath` is recorded in POSIX form (`/Users/...` or `/home/...`), so entries fall under `Local > Dev Container` directly. The UNC `\\wsl.localhost\...` discussion and `dev.containers.executeInWSL` setting below are **safe to skip** for non-Windows users.

The official Dev Containers extension (`ms-vscode-remote.remote-containers`) is implemented with `extensionKind: ["ui"]`, meaning **even from a WSL session, the extension itself always executes on the Windows-side VS Code**. This affects how Recents are recorded:

- When you open a WSL session via `code .` from a WSL terminal, then "Reopen in Container", the authority's hex JSON `hostPath` is written as a **Windows-side path (UNC `\\wsl.localhost\...`)**. The Dev Containers extension references the host folder from the UI (Windows) perspective
- As a result, "Dev Container opened from native Windows VS Code" and "Dev Container opened from a WSL session" are **indistinguishable at the authority level** (both are `dev-container+<hex>` and `hostPath` is UNC for both)
- This extension nests UNC `hostPath` entries under `WSL (<distro>) > Dev Container` to reflect the **fact that the files are on WSL**, not to identify the launch route (where you opened from)

#### Relationship with `dev.containers.executeInWSL`

Which Docker daemon is actually used is governed by the Windows-only setting `dev.containers.executeInWSL`:

| Setting | Workspace folder on WSL | Workspace folder on Windows |
|---|---|---|
| Default (OFF) | `docker` runs in WSL | Windows Docker (Docker Desktop) |
| ON | `docker` runs in WSL | `docker` runs in WSL |

Even at the default, if the workspace folder is on WSL, WSL Docker is used. The setting only matters if you want WSL Docker to be used for Windows-located folders too.

**Important**: Toggling this setting does **not** change the `hostPath` form (UNC vs Linux) recorded in Recent entries. The `hostPath` notation is decided at the point where the Dev Containers extension represents the host folder, independent of where the CLI actually runs. This extension cannot reverse-derive the Docker engine choice from a Recent entry.

This extension only assists with displaying and deleting Recents, so it does not interact with these settings directly.

## Known limitations

- This extension uses two VS Code internal commands (underscore prefix). No public API equivalent is offered, but Microsoft's first-party Remote extensions also depend on the same commands, so they're stable enough in practice. They could change or be removed in future versions:
  - `_workbench.getRecentlyOpened` — Retrieves the Recently Opened list. Public API request [microsoft/vscode#124577](https://github.com/microsoft/vscode/issues/124577) has been OPEN since 2021-05. Maintainers agree it could be promoted, but it hasn't been
  - `_files.windowOpen` — Same window routing as the official Open Recent (focus the matching-authority window + open file/folder, or spawn a new window). Public API request [microsoft/vscode#123615](https://github.com/microsoft/vscode/issues/123615) is OPEN. `vscode.openFolder` (folders only) and `vscode.open` (current window only) cannot correctly open cross-authority files. Maintainer bpasero recommends this command as the official workaround in [#122071's comment](https://github.com/microsoft/vscode/issues/122071#issuecomment-826279707). When internal commands are unavailable (e.g. vscode.dev web), the extension falls back to `vscode.open` / `vscode.openFolder`
- Dev Container authority encoding may vary across Dev Containers extension versions. The two known formats (JSON / raw path) are supported, but if neither `hostPath` nor `@<auth>` suffix can be parsed in an unknown format, the parent route can't be determined and the entry falls under `Local > Dev Container`
- Folder entries use the `folder-opened` codicon. The ids `folder` / `file` are special-cased internally by VS Code as sentinels — when `resourceUri` is unresolved on remote, nothing is drawn ([microsoft/vscode#146479](https://github.com/microsoft/vscode/issues/146479)). This choice avoids that. The trade-off is that file-icon-theme folder-name specializations (`.git` / `node_modules` etc.) don't apply

## License

MIT

---

<a id="日本語"></a>

# 日本語

[English](#recent-by-remote) | **日本語**

VS Code の「Open Recent」履歴を**接続経路ごとに分類表示**し、不要なエントリを選択削除できるようにする拡張機能です。

## 概要

VS Code 公式の Quick Pick（`Ctrl+R`）では、Remote 経由のエントリが全て同じような表記で並び、Tunnel / WSL / Dev Container / SSH の区別がつきにくい場面があります。特に同じフォルダを複数経路で開いていると、どれがどの経路か判別できずに整理が困難になります。

本拡張は公式の Recently Opened リストをそのまま利用し、接続経路ごとにグループ化した TreeView を Activity Bar に追加します。自前の履歴データは持たず、公式データに対する表示と削除操作のみを提供します。

経路ごとにツリーが分かれているので、**もう使わなくなった経路のエントリだけをまとめて見つけて整理する**用途にも便利です（撤去した tunnel host、停止中の SSH ホスト、消した dev container 由来の `\\wsl.localhost\<distro>\...` 履歴 等）。各行のゴミ箱アイコンから公式 Recently Opened に対してそのまま削除を反映できます。

## 対応プラットフォーム

Windows / macOS / Linux すべてで動作します。経路分類のうち **WSL** グループは Windows でのみ出現します（WSL 自体が Windows の機能のため）。macOS / Linux 上の Dev Container は `hostPath` が POSIX 形式（`/Users/...` や `/home/...`）で書き込まれるため、`Local > Dev Container` 配下に分類されます。

## Before / After

### Before — VS Code 標準の Open Recent

![Standard VS Code Open Recent menu, where multiple entries labeled "[Dev Container]" provide no clue as to which underlying route they were reached via](https://raw.githubusercontent.com/kyanet/vscode-recent-by-remote/main/resources/screenshots/before-open-recent.png)

複数の `[Dev Container]` エントリが並んでも、それぞれが **WSL 経由 / Tunnel 経由 / SSH 経由** のどれなのか判別できない。経路情報が抜け落ちているため、同じ devcontainer 名のエントリが何個も並ぶと取り違えやすい。`[WSL: distro]` `[SSH: ip]` のような直エントリは経路は分かるが、フォルダ名と経路が同じ行に詰め込まれて視線が忙しい。

### After — Recent by Remote

![Tree view organized by remote type. Each top-level node is a route (Tunnel/WSL/SSH), with direct entries first and a Dev Container sub-group at the bottom showing the count of containers reached via that route.](https://raw.githubusercontent.com/kyanet/vscode-recent-by-remote/main/resources/screenshots/after-tree-view.png)

経路ごとにツリーが分割され、`Dev Container` サブグループが**親経路の末尾に配置**されるので「Tunnel 経由の dev container」「WSL 経由の dev container」「SSH 経由の dev container」が一目で区別できる。同じファイルパス `/workspaces/myProject1` でも、どの経路の上で動いている container 内のものかが構造で判る。`(connect, no folder)` も各経路に自動付与されるので、フォルダなしで素のセッションに戻る導線も常に確保されている。

## 主な機能

- **経路別グループ化**: Tunnel / WSL / SSH / Local / Other に自動分類。各見出しに経路を表すアイコン（`radio-tower` / `terminal-linux` / `key` / `device-desktop` / `question`）が付く
- **ホスト名併記**: `Tunnel (myhost)`、`WSL (Ubuntu)`、`SSH (myserver)` のようにホスト単位でさらに分割
- **Dev Container は親経路の配下にネスト**: Dev Container は単独の経路グループにせず、ファイルが置かれているホスト経路（例: `Tunnel (myhost)`、`WSL (Ubuntu)`、`Local`）の配下に **`Dev Container`** サブグループ（`package` アイコン、件数 description 付き＝例 `3 items`）として収まる。dev container がどの経路上で動作しているかが視覚的に明確になる
- **直エントリ → Dev Container サブグループの並び順**: 各経路グループの中身は「経路に直接置かれたフォルダ／ワークスペース／(connect, no folder)」が先頭にまとまり、`Dev Container` サブグループは末尾に配置される。直開きとコンテナ内開きが視覚的に分離され、同名フォルダ（例: WSL 直下の `myProject1 /home/user/myProject1` と Dev Container 内の `myProject1 \\wsl.localhost\<distro>\home\user\myProject1`）の見分けがつきやすい
- **Dev Container のホストパス単位サブグループ**: 同じ devcontainer 定義を複数の異なるサブフォルダで開いていても、authority に埋め込まれたホスト側プロジェクトフォルダ (`hostPath`) でまとめて 1 ノード化（`package` アイコン、Dev Container サブグループと同系統で視覚チェーンが繋がる）。コンテナ内パスが `/workspace` で衝突するケースもホスト側プロジェクト名で区別できる
- **テーマ追従カラーバッジのツールチップ**: ホバー時、エントリ種別 / kind / 親経路（Dev Container の場合）を VS Code のテーマカラー (`--vscode-charts-*` / `--vscode-badge-*`) に追従するバッジで表示。Dark / Light どちらでも視認可能。`uri` / `host` / `path` のフル情報も併記
- **接続のみエントリ**: Tunnel / WSL / SSH の各経路に `(connect, no folder)` という疑似エントリを自動追加。フォルダを開かずにそのリモートに繋ぐだけのアクションをワンクリックで起動できる。dev container 経由のエントリしかない経路（例: `WSL (distro-X)` 上に dev container 履歴だけ残っているケース）でも、authority から親経路を逆算して `(connect, no folder)` が出るので、その distro へ素のセッションで繋ぎ直す導線が常に確保される
- **フォルダ・ワークスペース・ファイルを横断表示**: 「最近開いたフォルダ／ワークスペース」だけでなく「最近開いたファイル」も同じビューに並ぶ（アイコンで識別）
- **プロジェクトルート相対のファイル表示**: コンテナ内 `fullPath` が `hostPath` 配下にあるファイルは description を相対パスに短縮表示（マウントパスがホストとずれている一般構成では in-container の絶対パスを表示）
- **グループモード切り替え**: タイトルバーのアイコンで「経路だけでグループ化（混在表示）」と「タイプ→経路の二段グループ化（Workspaces & Folders / Files で分離）」を切り替えられる。選択状態はグローバルに保存される
- **個別削除**: 各エントリ横のゴミ箱アイコンから公式 Recently Opened から削除
- **ワンクリックで開く（VS Code 標準 Open Recent と同等のウィンドウルーティング）**: エントリをクリックすると、該当 authority のウィンドウが既に開いていればそれにフォーカス + ファイル/フォルダ open、無ければ新規ウィンドウで authority を解決して open
- **別ウィンドウで開く**: 行ホバー時の `$(empty-window)` ボタン、右クリック「Open in New Window」、または Quick Pick のアイテムボタンから別ウィンドウで開ける
- **Quick Pick 版コマンド**: コマンドパレットから `Recent by Remote: Open...` で全エントリを経路プレフィックス付きで検索・選択

### ツリー構造のイメージ

各経路グループの中身は「直エントリ → 末尾に Dev Container サブグループ」の順に並びます。

```
Recent by Remote: Recently Opened
├─ Tunnel (name)                                          ← 経路グループ (radio-tower)
│  ├─ myProject1         /home/user/myProject1            ← 直開きエントリ (folder-opened)
│  ├─ devcontainer.json  /home/user/myProject1/.devcontainer
│  ├─ (connect, no folder)                                ← 接続のみエントリ (plug)
│  └─ Dev Container                1 item                 ← サブグループ末尾に集約 (package)
│      └─ myProject1     /home/user/myProject1            ← hostPath サブグループ (package)
│          └─ myProject1 /workspaces/myProject1
├─ WSL (distro)                                           (terminal-linux)
│  ├─ myProject1         /home/user/myProject1            ← WSL 直下のフォルダ
│  ├─ myProject2         /home/user/myProject2
│  ├─ (connect, no folder)
│  └─ Dev Container                1 item
│      └─ myProject1     \\wsl.localhost\distro\home\user\myProject1
│          └─ myProject1 /workspaces/myProject1
├─ SSH (IP address)                                       (key)
│  ├─ myProject2         /home/user/myProject2
│  ├─ myProject1         /home/user/myProject1
│  ├─ user               /home/user
│  ├─ (connect, no folder)
│  └─ Dev Container                2 items
│      └─ myProject1     /home/user/myProject1
│          ├─ myProject1        /workspaces/myProject1
│          └─ devcontainer.json /workspaces/myProject1/.devcontainer
└─ Local                                                  (device-desktop)
   └─ ...
```

凡例: `Dev Container` 行右側の `1 item` / `2 items` 部分は TreeItem の description（薄色）として描画されます。HostPathGroupNode は本拡張で扱う `hostPath` が現状 Dev Container authority 由来のみのため、実運用ではほぼ全て `package` アイコン側になります（`repo` アイコンは将来 dev container 以外で `hostPath` が付与されるケース用に予約されています）。

## インストール

### Marketplace から

Extensions ビューで `Recent by Remote` を検索してインストールします。Marketplace ID は `kyanet.recent-by-remote` です。

### VSIX からインストール

リリースページから `.vsix` ファイルをダウンロードし、VS Code の Extensions ビューで右上メニュー → 「Install from VSIX...」を選択してインストールします。

### ソースからビルド

```bash
pnpm install
pnpm run vsix
```

`pnpm run vsix` は production ビルド（型チェック + lint + esbuild）を実行した上で `recent-by-remote-<version>.vsix` を生成します。生成された `.vsix` ファイルを上記の手順でインストールしてください。

## リリース手順

タグ push を起点に GitHub Actions が `.vsix` をビルドして GitHub Release に添付します。メンテナの操作は以下の 2 行のみです。

```bash
pnpm version patch    # patch / minor / major のいずれか。package.json と git tag を更新
git push --follow-tags
```

`v*` 形式のタグが push されると [.github/workflows/release.yml](.github/workflows/release.yml) が起動し、

1. tag のバージョンと `package.json` の version の整合性を検証
2. `pnpm run vsix` で `.vsix` を生成
3. GitHub Release を作成し、`.vsix` を添付（リリースノートは前回タグからのコミットを元に自動生成）

を行います。マーケットプレイス公開は `vsce publish` で手動。

## 使い方

1. 拡張機能を有効化すると、Activity Bar に履歴アイコン（`$(history)`）が追加されます
2. アイコンをクリックすると「Recent by Remote: Recently Opened」ビューが開きます
3. 経路別にグループ化された Recently Opened エントリが一覧表示されます
4. 各エントリに対して以下の操作が可能です：
   - **行クリック**: VS Code 標準の Open Recent と同じルーティングで開く。同一 authority のウィンドウが既にあればそれにフォーカス + open、無ければ新規ウィンドウで authority を解決
   - **Open in New Window ボタン** (`$(empty-window)`): 別ウィンドウで開く（Ctrl+Click 相当）
   - **Remove ボタン** (`$(trash)`): 公式 Recently Opened から削除
   - **右クリックメニュー**: 「Open」「Open in New Window」「Remove from Recent」を提供
   - **`(connect, no folder)` エントリ**: 該当 authority に接続だけする空ウィンドウを開く（フォルダ未指定）
5. `Recent by Remote: Open...` の Quick Pick でも、各アイテム右側の `$(empty-window)` ボタンから別ウィンドウで開けます
6. タイトルバーの Refresh ボタンまたは `Recent by Remote: Refresh` コマンドでビューを更新できます

### コマンド一覧

| コマンド | 説明 |
|---|---|
| `Recent by Remote: Refresh` | TreeView を再読込 |
| `Recent by Remote: Open...` | 全エントリの Quick Pick から 1 つ選んで開く |
| `Recent by Remote: Group by Type (Workspaces / Files)` | タイプ→経路の二段グループ化に切り替え |
| `Recent by Remote: Group by Remote Only` | 経路だけのグループ化（混在表示）に切り替え |
| `Recent by Remote: Toggle Group Mode` | 上記 2 モードをトグル（キーバインド向け） |

> VS Code を日本語ロケールで使っている場合、コマンドパレット上のコマンド title は自動的に日本語表記（例: 「Recent by Remote: 更新」）に切り替わります。

## 経路分類のロジック

各エントリは VS Code 内部 API `_workbench.getRecentlyOpened` から取得した `remoteAuthority` フィールドを元に分類されます。

| 分類 | 判定条件 |
|---|---|
| Local | `remoteAuthority` なし |
| WSL | `wsl+<distro>` で始まる |
| Tunnel | `tunnel+<host>` で始まる |
| SSH | `ssh-remote+<host>` で始まる |
| Dev Container | `dev-container+<hex>` または `attached-container+<hex>` |
| Other | 上記以外 |

### Dev Container の親経路判別

Dev Container エントリ（`dev-container+<hex>` または `attached-container+<hex>` で始まる authority）は、ファイルが置かれているホスト経路に応じて、親グループの直下に `Dev Container` サブグループとして配置されます。本拡張は authority hex 部分（JSON）と末尾の `@<auth>` 接尾辞をデコードして親経路を判別します：

| ホストパス / 接尾辞 | 親グループ |
|---|---|
| 接尾辞 `@tunnel+myhost` | `Tunnel (myhost)` |
| 接尾辞 `@wsl+ubuntu` | `WSL (Ubuntu)` |
| 接尾辞 `@ssh-remote+myserver` | `SSH (myserver)` |
| `hostPath = \\wsl.localhost\Ubuntu\...`（接尾辞なし） | `WSL (Ubuntu)` ※1 |
| `hostPath = C:\...`（接尾辞なし） | `Local` |
| `hostPath = /home/...`（接尾辞なし） | `Local` |

※1 公式 Dev Containers 拡張は `extensionKind: ["ui"]` 固定のため、WSL session で開いた dev container でも `hostPath` は Windows から見た UNC 形式で書き込まれます（次節参照）。本拡張は UNC 形式から WSL distro 名を抽出し、対応する `WSL (<distro>)` グループ配下にぶら下げます。

さらに、Dev Container サブグループ内のエントリは `hostPath`（ホスト側プロジェクトフォルダ）単位でサブグループ化されます。同じ devcontainer 定義に対してルートで開いた履歴とサブフォルダで開いた履歴が複数残っていても、1 つのノード配下に集約されて一覧できます（`package` アイコン）。サブグループのラベルにはホスト側フォルダの basename を使うので、コンテナ内パスが `/workspace` で衝突する複数の Dev Container もホスト側プロジェクト名で見分けられます。

### Dev Containers 拡張は常に Windows VS Code 側で動く（UI extension）

> **注意**: 以下のセクションは **Windows + WSL 環境特有の挙動**の説明です。macOS / Linux でも Dev Containers 拡張は同じく UI 側で動きますが、`hostPath` は POSIX 形式（`/Users/...` や `/home/...`）で書き込まれるため、本拡張上では `Local > Dev Container` 配下にそのまま分類されます。以下の UNC `\\wsl.localhost\...` 関連の説明と `dev.containers.executeInWSL` 設定は読み飛ばして構いません。

公式 Dev Containers 拡張（`ms-vscode-remote.remote-containers`）は `extensionKind: ["ui"]` で実装されており、**WSL session の VS Code でも実行は常に Windows 側 VS Code 上**です。このため、Recent への記録のされ方には以下の制約があります:

- WSL ターミナルから `code .` で開いた WSL session 上で「Reopen in Container」しても、authority hex JSON の `hostPath` は **Windows から見たパス（UNC `\\wsl.localhost\...`）** で書き込まれます。Dev Containers 拡張は UI(Windows) 側で動くので、ホスト folder を Windows 視点で参照するため
- 結果として、Recent エントリ上は「Windows ネイティブの VS Code から開いた dev container」と「WSL session から開いた dev container」が **authority レベルで見分けられません**（どちらも `dev-container+<hex>`、`hostPath` は UNC で揃う）
- 本拡張が UNC hostPath を `WSL (<distro>) > Dev Container` 配下にぶら下げているのは、**「ファイルが WSL 上にある」という事実**を反映するためであり、起動経路（どこから開いたか）を識別しているわけではありません

#### `dev.containers.executeInWSL` 設定との関係

実際にどの Docker daemon が使われるかは、`dev.containers.executeInWSL` という Windows 専用設定で決まります。

| 設定 | workspace folder が WSL 上 | workspace folder が Windows 上 |
|---|---|---|
| デフォルト（OFF） | WSL 内で `docker` を実行 | Windows Docker (Docker Desktop) |
| ON | WSL 内で `docker` を実行 | WSL 内で `docker` を実行 |

つまりデフォルト挙動でも、workspace folder が WSL 上にあれば WSL 内 Docker が使われます。Windows 上のフォルダでも WSL 内 Docker を使いたい場合のみ ON にする設定です。

**重要**: この設定を切り替えても、Recent エントリの `hostPath` 形式（UNC vs Linux）は変わりません。`hostPath` の表記は Dev Containers 拡張がホスト folder を表現する段で固まる話で、CLI 実行場所とは独立しています。本拡張から Docker engine の選択を逆算することはできません。

本拡張は Recent の表示と削除の補助だけを行うので、これらの設定に直接干渉することはありません。

## 既知の制約

- 本拡張は以下の VS Code 内部コマンド（underscore prefix）を 2 つ使用しています。いずれも公開 API では同等の機能が提供されておらず、Microsoft の Remote 系 first-party 拡張も同じコマンドに依存しているため、実用上の安定性は十分にあります。ただし将来のバージョンで変更・削除される可能性はあります
  - `_workbench.getRecentlyOpened` — Recently Opened 一覧を取得。公開 API 化要望は [microsoft/vscode#124577](https://github.com/microsoft/vscode/issues/124577) で 2021-05 から OPEN のまま。メンテナ間で「昇格してもよい」と合意済みだが未実装
  - `_files.windowOpen` — 標準 Open Recent と同じウィンドウルーティング（authority 一致するウィンドウへフォーカス + ファイル/フォルダ open）を行うコマンド。公開 API 化要望は [microsoft/vscode#123615](https://github.com/microsoft/vscode/issues/123615) で OPEN のまま。`vscode.openFolder`（フォルダ専用）と `vscode.open`（現在ウィンドウのみ）では cross-authority のファイルを正しく開けないため、メンテナ bpasero が [#122071 のコメント](https://github.com/microsoft/vscode/issues/122071#issuecomment-826279707) で本コマンドを公式回避策として推奨。本拡張は内部コマンドが利用できない環境（Web 版 vscode.dev など）では `vscode.open` / `vscode.openFolder` にフォールバックします
- Dev Container の authority エンコード形式は Dev Containers 拡張のバージョンによって異なる場合があります。既知の 2 形式（JSON / 生パス）に対応していますが、未知の形式で `hostPath` も `@<auth>` 接尾辞も読み取れない場合、親経路が判定できず `Local > Dev Container` 配下に分類されます
- フォルダエントリのアイコンには `folder-opened` codicon を採用しています。`folder` / `file` という id は VS Code 内部で sentinel として特別扱いされ、`resourceUri` がリモートで未解決の場合に何も描画されない既知の挙動（[microsoft/vscode#146479](https://github.com/microsoft/vscode/issues/146479)）があるため、それを避ける目的の選択です。代わりにファイルアイコンテーマによるフォルダ名別の特殊アイコン（`.git` / `node_modules` 等）は適用されません

## ライセンス

MIT
