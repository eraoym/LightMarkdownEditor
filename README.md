# Light Markdown Editor

「今すぐ書いて、すぐ見れる」をコンセプトにした、シンプルなデスクトップ向け Markdown エディタ。

Tauri v2 + React 19 + TypeScript で構築されています。

---

## 機能

| 機能 | 説明 |
| --- | --- |
| 新規作成 | 起動時に空の編集画面を表示 |
| ファイルを開く | OS のファイルダイアログで `.md` ファイルを選択して読み込む |
| リアルタイムプレビュー | EditMode / PreviewMode をヘッダーのトグルで切り替え |
| 上書き保存 | `Ctrl+S` で現在開いているファイルに保存 |
| 名前を付けて保存 | 新規ファイルの初回保存時はダイアログで保存先を指定 |
| ダークモード | OS のライト/ダークテーマに自動連動 |

---

## 技術スタック

| カテゴリ | 技術 |
| --- | --- |
| デスクトップフレームワーク | Tauri v2 |
| フロントエンド | React 19 + TypeScript 5.8 |
| ビルドツール | Vite 7 |
| CSS | Tailwind CSS v4（`@tailwindcss/vite` 経由） |
| Markdown レンダリング | `react-markdown` + `remark-gfm` |
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
# 依存パッケージをインストール
pnpm install
```

> node_modules の状態がおかしい場合は `CI=true pnpm install` を使う（[troubleshooting](#トラブルシューティング) 参照）。

---

## 開発・ビルド

```bash
# Tauri 開発モード（Vite dev server + Rust ビルドが同時起動）
pnpm tauri dev

# フロントエンドのみ確認（ブラウザで http://localhost:1420）
pnpm dev

# プロダクションビルド（src-tauri/target/release/bundle/ にインストーラが生成）
pnpm tauri build
```

> 初回の `pnpm tauri dev` は Rust クレートのコンパイルに数分かかります。2回目以降はキャッシュにより高速です。

---

## ディレクトリ構成

```text
LightMarkdownEditor/
├── src/                     # フロントエンド（React/TypeScript）
│   ├── main.tsx
│   ├── App.tsx              # 状態管理・キーボードショートカット・Tauri 呼び出し
│   ├── components/
│   │   ├── Header.tsx       # 「開く」ボタン、ファイル名、保存状態、モード切替
│   │   ├── Editor.tsx       # textarea（EditMode）
│   │   └── Preview.tsx      # react-markdown（PreviewMode）
│   └── index.css
├── src-tauri/               # バックエンド（Rust / Tauri）
│   ├── src/
│   │   ├── main.rs
│   │   └── lib.rs
│   ├── capabilities/
│   │   └── default.json     # Tauri パーミッション設定
│   └── Cargo.toml
├── docs/                    # 設計ドキュメント
├── index.html
├── vite.config.ts
└── package.json
```

---

## トラブルシューティング

### pnpm の virtual store ズレ

```text
ERR_PNPM_UNEXPECTED_VIRTUAL_STORE
```

プロジェクトのディレクトリ構造を変更した後に発生することがある。以下で解決する。

```bash
CI=true pnpm install
```

### Tailwind CSS v4 の設定

v4 では `tailwind.config.js` / `postcss.config.js` は**不要**。`vite.config.ts` に `@tailwindcss/vite` プラグインを追加し、`index.css` に `@import "tailwindcss";` を記述するだけでよい。

### tauri.conf.json と vite.config.ts のポート不一致

`devUrl`（tauri.conf.json）と `server.port`（vite.config.ts）は同じ値（デフォルト: `1420`）に揃える必要がある。変更する場合は両方を同時に変更すること。

### CI 環境・非対話型ターミナルでの pnpm エラー

```text
ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY
```

先頭に `CI=true` を付けて実行する。

```bash
CI=true pnpm install
```

---

## ドキュメント

詳細は [docs/](docs/) を参照してください。

| ファイル | 内容 |
| --- | --- |
| [docs/01_concept.md](docs/01_concept.md) | MVPコンセプト・要件定義 |
| [docs/02_frontend.md](docs/02_frontend.md) | フロントエンド設計（React + Tailwind） |
| [docs/03_backend.md](docs/03_backend.md) | バックエンド設計（Tauri ファイル操作） |
| [docs/architecture.md](docs/architecture.md) | プロジェクト構成・技術スタック |
| [docs/setup_guide.md](docs/setup_guide.md) | 環境構築手順（Windows 11） |
| [docs/status.md](docs/status.md) | 実装状況 |
| [docs/troubleshooting.md](docs/troubleshooting.md) | トラブルシューティング詳細 |
