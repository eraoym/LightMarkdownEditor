# プロジェクト構成

> 最終更新: 2026-03-15

---

## 技術スタック

| カテゴリ | パッケージ / バージョン |
|---|---|
| デスクトップフレームワーク | Tauri v2 (`tauri ^2`) |
| フロントエンドフレームワーク | React 19.2 |
| 言語 | TypeScript 5.8 |
| ビルドツール | Vite 7.3 |
| CSS フレームワーク | **Tailwind CSS v4.2**（`@tailwindcss/vite` 経由） |
| CSS タイポグラフィ | `@tailwindcss/typography`（`prose` クラス） |
| Markdown レンダリング | `react-markdown` + `remark-gfm` |
| パッケージマネージャ | pnpm |
| バックエンド言語 | Rust (edition 2021) |
| Tauri ファイル操作 | `tauri-plugin-fs` + `@tauri-apps/plugin-fs` |
| Tauri ダイアログ | `tauri-plugin-dialog` + `@tauri-apps/plugin-dialog` |

---

## ディレクトリ構造

```
LightMarkdownEditor/
├── src/                     # フロントエンド（React/TypeScript）
│   ├── main.tsx             # エントリポイント、index.css をここでインポート
│   ├── App.tsx              # メインコンポーネント（Markdown textarea UI）
│   ├── index.css            # Tailwind CSS エントリポイント
│   ├── App.css              # 旧サンプル CSS（現在未使用）
│   ├── assets/
│   │   └── react.svg
│   └── vite-env.d.ts
├── src-tauri/               # バックエンド（Rust / Tauri）
│   ├── src/
│   │   ├── main.rs          # エントリポイント（lib.rs の run() を呼ぶだけ）
│   │   └── lib.rs           # Tauri コマンド定義・アプリ初期化
│   ├── capabilities/
│   │   └── default.json     # Tauri パーミッション設定
│   ├── icons/               # アプリアイコン一式
│   ├── tauri.conf.json      # Tauri 設定（ウィンドウサイズ、ビルド設定など）
│   └── Cargo.toml           # Rust 依存関係
├── docs/                    # ドキュメント
│   ├── 01_concept.md        # MVPコンセプト・要件定義
│   ├── 02_frontend.md       # フロントエンド設計（React + Tailwind）
│   ├── 03_backend.md        # バックエンド設計（Tauri ファイル操作）
│   ├── setup_guide.md       # 環境構築・起動手順
│   ├── architecture.md      # 本ファイル
│   ├── troubleshooting.md   # ハマりやすいポイント
│   └── status.md            # 実装状況
├── public/                  # 静的アセット（vite.svg, tauri.svg）
├── index.html               # Vite HTML エントリポイント
├── vite.config.ts           # Vite 設定（Tailwind v4 プラグイン含む）
├── tsconfig.json            # TypeScript 設定
├── package.json
└── pnpm-lock.yaml
```
