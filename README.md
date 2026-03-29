# Light Markdown Editor

「今すぐ書いて、すぐ見れる」をコンセプトにした、軽量なデスクトップ向け Markdown エディタ。

Tauri v2 + React 19 + TypeScript で構築。

---

## リリースノート

### v0.5.1 — 2026-03-29

#### Added

- **ヘッダーバージョン表示** — ヘッダー右端（⚙ボタン左）に現在のアプリバージョン（`vX.Y.Z`）を表示

---

### v0.5.0 — 2026-03-29

#### Added

- **インタラクティブチェックボックス** — プレビュー画面でチェックボックスをクリックしてエディタ側の Markdown を即時切替（`- [ ]` ↔ `- [x]`）
- **日時入力ショートカット** — `Ctrl+;` で現在日付（`YYYY/M/D` 形式）、`Ctrl+:` で現在時刻（`hh:mm` 形式）をカーソル位置に挿入
- **画像貼り付けショートカット `Ctrl+Alt+V`** — Excel コピー時の誤動作を解消。`Ctrl+V` はテキスト貼り付け専用に変更し、画像貼り付けは `Ctrl+Alt+V` で明示的に実行

#### Fixed

- TOC（目次）がコードブロック内の `#` 始まり行を見出しとして拾う不具合を修正

---

### v0.4.0 — 2026-03-20

#### Added

- **テーブル挿入** — ツールバー `⊞` ボタンで Markdown テーブルテンプレートを挿入。テキスト選択時はカンマ区切りテキストをテーブルに変換
- **Excel 貼り付け（Ctrl+Shift+V）** — クリップボードのタブ区切りテキストを Markdown テーブルとして挿入
- **操作マニュアル** — `docs/manual.md` に全機能のキーボードショートカット・操作手順を整備

#### Fixed

- Tab キー押下時に意図しない行が挿入されるバグを修正

---

### v0.3.1 — 2026-03-18

#### Added

- **ドラッグ＆ドロップでファイルを開く** — ファイルをウィンドウにドロップして直接開く。フォルダをドロップするとエクスプローラーサイドバーに表示
- **アイコンへのドロップ** — アプリアイコンにファイルをドロップして起動すると自動で開く
- ドラッグ中のビジュアルフィードバック（青いオーバーレイ表示）

#### Fixed

- D&D 時に同一ファイルが 2 タブ開く問題を修正（`await` 後の重複チェックを追加）

---

### v0.3.0 — 2026-03-18

#### Added

- **PDF 印刷** — プレビューモードの PDF ボタンからブラウザ印刷ダイアログを呼び出し、プレビュー内容のみを出力
- **ページ番号** — PDF 印刷時にページ下部中央へページ番号を自動表示（CSS `@bottom-center`）
- **改ページ指定** — Markdown の `---` を印刷時の改ページとして扱える
- **プレビューテーマ切替** — GitHub / Minimal / Academic の 3 テーマを選択可能（設定モーダルから変更）
- **ウィンドウサイズ永続化** — アプリ再起動後もウィンドウサイズを復元

#### Fixed

- Mermaid ダイアグラム・コードブロックのライトモード表示を修正

---

### v0.2.0 — 2026-03-17

#### Added

- **設定モーダル** — エディタのフォントサイズ・フォントファミリー・タブ幅を変更可能。設定は localStorage に永続化
- **シンタックスハイライト** — `highlight.js` によるコードブロックのハイライト表示（`hljs-theme.css`）
- **スプリットプレビュー** — 編集モードでエディタとプレビューを横並び表示。境界線をドラッグして幅を調整可能（幅は localStorage に永続化）
- **TOC サイドバー** — プレビューモードで目次を表示。見出しをクリックしてスクロールジャンプ
- **セッション復元** — 起動時に前回開いていたタブ・エクスプローラーのフォルダを自動復元
- **タブ右クリックメニュー** —「タブを閉じる」「他のタブをすべて閉じる」「すべてのタブを閉じる」
- **Mermaid ダイアグラム** — コードブロックでダイアグラムをレンダリング
- **画像ペースト** — クリップボードから画像をファイルに保存してリンクを自動挿入
- **アプリアイコン** — iOS / Android / Windows 向けアイコン一式を刷新

#### Changed

- `Editor` のタブ幅を設定から動的に変更可能に
- フォントサイズをエディタ設定で上書き可能に

---

### v0.1.0 — 2025-03-16

#### Added

- **Markdown エディタ** — Edit / Preview モード切替、リアルタイムプレビュー
- **ファイルタブ** — 複数ファイルをタブで管理。未保存インジケーター（●）表示
- **エクスプローラーサイドバー** — フォルダツリーからファイルを開く。遅延展開対応
- **ツールバー** — Bold / Italic / H1-H3 / 箇条書き / 番号リスト / コード挿入ボタン
- **Undo/Redo** — タブごとに独立した履歴（最大200エントリ、500msデバウンス）
- **ファイル操作** — 開く・上書き保存（Ctrl+S）・名前を付けて保存
- **キーボードショートカット** — Ctrl+B（太字）、Ctrl+I（斜体）、Ctrl+Z/Y（Undo/Redo）、Ctrl+Tab（タブ切替）
- **ダークモード** — OS テーマ連動 + ヘッダーボタンによる手動切替
- **Tab インデント** — Tab キーでスペース挿入、Shift+Tab で削除
- **括弧自動補完** — `(` `[` `{` `` ` `` `"` `'` 入力時に閉じ括弧を自動挿入

---

## 機能

| 機能 | 説明 |
| --- | --- |
| ファイル操作 | 開く・上書き保存（Ctrl+S）・名前を付けて保存 |
| ドラッグ＆ドロップ | ファイル/フォルダをウィンドウにドロップして開く。アイコンへのドロップも対応 |
| ファイルタブ | 複数ファイルをタブで管理、未保存インジケーター表示 |
| エクスプローラー | フォルダツリーからファイルを開く |
| Markdown プレビュー | Edit / Preview / Split（横並び）モードを切替 |
| TOC サイドバー | 見出し一覧を表示、クリックでジャンプ |
| ツールバー | Bold / Italic / H1-H3 / リスト / コード / テーブル挿入ボタン |
| Undo/Redo | タブごとに独立した履歴（最大200エントリ） |
| 画像ペースト | `Ctrl+Alt+V` でクリップボードの画像をファイルに保存してリンク挿入 |
| チェックボックス操作 | プレビュー上でクリックして完了/未完了を切替（Markdown を即時更新） |
| 日時入力 | `Ctrl+;`（日付）/ `Ctrl+:`（時刻）でカーソル位置に挿入 |
| シンタックスハイライト | コードブロックのハイライト表示 |
| Mermaid 図 | コードブロックでダイアグラムをレンダリング |
| PDF 印刷 | プレビューを PDF 出力（ページ番号・改ページ対応） |
| プレビューテーマ | GitHub / Minimal / Academic の 3 テーマ |
| 設定 | エディタのフォントサイズ・フォントファミリー・タブ幅 |
| ダークモード | OS テーマ連動 + 手動切替 |
| バージョン表示 | ヘッダー右端に現在のアプリバージョンを表示 |
| セッション復元 | 前回開いていたタブ・フォルダを起動時に自動復元 |

---

## 技術スタック

| カテゴリ | 技術 |
| --- | --- |
| デスクトップフレームワーク | Tauri v2 |
| フロントエンド | React 19 + TypeScript 5.8 |
| ビルドツール | Vite 7 |
| CSS | Tailwind CSS v4 |
| Markdown レンダリング | `react-markdown` + `remark-gfm` |
| シンタックスハイライト | `highlight.js` |
| ダイアグラム | `mermaid` |
| パッケージマネージャ | pnpm |
| バックエンド | Rust (edition 2021) |

---

## セットアップ

### 必要なツール

- **Rust** — [rustup.rs](https://rustup.rs/) からインストール。Windows では MSVC（Visual Studio の「C++ によるデスクトップ開発」）も必要。
- **Node.js** — fnm などのバージョンマネージャ経由を推奨。
- **pnpm** — `npm install -g pnpm` または `winget install pnpm.pnpm`

### インストール

```bash
pnpm install
```

---

## 開発・ビルド

```bash
# 開発モード（Vite dev server + Rust ビルド）
pnpm tauri dev

# フロントエンドのみ（ブラウザで http://localhost:1420）
pnpm dev

# プロダクションビルド（src-tauri/target/release/bundle/ にインストーラ生成）
pnpm tauri build
```

> 初回の `pnpm tauri dev` は Rust クレートのコンパイルに数分かかります。

---

## ディレクトリ構成

```text
LightMarkdownEditor/
├── src/                      # フロントエンド（React/TypeScript）
│   ├── App.tsx               # 状態管理・キーボードショートカット
│   ├── components/
│   │   ├── Header.tsx        # ヘッダー・モード切替・設定ボタン
│   │   ├── Editor.tsx        # textarea エディタ
│   │   ├── Preview.tsx       # Markdown レンダリング
│   │   ├── Toolbar.tsx       # 書式挿入ツールバー
│   │   ├── TabBar.tsx        # ファイルタブ
│   │   ├── Explorer.tsx      # フォルダツリー
│   │   ├── TocSidebar.tsx    # 目次サイドバー
│   │   └── SettingsModal.tsx # 設定モーダル
│   ├── hooks/
│   │   ├── useTabs.ts
│   │   ├── useEditorActions.ts
│   │   └── useHistory.ts
│   ├── styles/
│   │   └── hljs-theme.css    # シンタックスハイライトテーマ
│   └── types.ts
├── src-tauri/                # バックエンド（Rust / Tauri）
│   ├── src/lib.rs
│   ├── capabilities/
│   │   └── default.json      # Tauri パーミッション設定
│   └── Cargo.toml
├── docs/                     # 設計ドキュメント
└── package.json
```

---

## トラブルシューティング

### pnpm の virtual store ズレ

```text
ERR_PNPM_UNEXPECTED_VIRTUAL_STORE
```

プロジェクトのディレクトリを移動した後などに発生する。以下で解決する。

```bash
CI=true pnpm install
```

### Tailwind CSS v4 の設定

v4 では `tailwind.config.js` / `postcss.config.js` は不要。`vite.config.ts` に `@tailwindcss/vite` プラグインを追加し、`index.css` に `@import "tailwindcss";` を記述するだけでよい。

### tauri.conf.json と vite.config.ts のポート不一致

`devUrl`（tauri.conf.json）と `server.port`（vite.config.ts）は同じ値（デフォルト: `1420`）に揃える。

---

## ドキュメント

| ファイル | 内容 |
| --- | --- |
| [docs/01_concept.md](docs/01_concept.md) | MVPコンセプト・要件定義 |
| [docs/02_frontend.md](docs/02_frontend.md) | フロントエンド設計 |
| [docs/status.md](docs/status.md) | 実装状況 |
| [docs/manual.md](docs/manual.md) | 操作マニュアル |
