# 実装状況

> 最終更新: 2026-03-16（EditMode/PreviewMode 切り替え対応）

---

## 実装済み

- Tauri v2 + React 19 + TypeScript のプロジェクト基盤
- Vite 7 によるフロントエンドビルド環境
- Tailwind CSS v4 の導入（`@tailwindcss/vite` プラグイン経由）
- OS のライト/ダークテーマへの自動連動（`prefers-color-scheme`）
- Markdown テキストの入力 UI（`textarea`、モノスペースフォント、80vh 高さ）
- `pnpm tauri dev` でデスクトップウィンドウの起動確認
- TypeScript の型チェックエラーなし（`tsc --noEmit` 通過済み）
- Markdown プレビュー（`react-markdown` + `remark-gfm` + `@tailwindcss/typography`）
- EditMode / PreviewMode 切り替え（ヘッダーのトグルボタンで全画面表示を切替）
- ファイルの保存・読み込み（`tauri-plugin-fs` + `tauri-plugin-dialog`、Ctrl+S 対応）
- ウィンドウタイトル（開いているファイル名を反映、新規は `light-md`）

---

## 設計済み・未実装（MVP対象）

現時点では設計済みの MVP 機能はすべて実装済みです。

---

## 未実装（MVP対象外）

現時点では実装しない機能。

| 機能 | 概要 |
|---|---|
| シンタックスハイライト | コードブロックのカラーリング |
| テキスト編集補助 | ツールバーによる Markdown 記法の挿入 |
| ファイルタブ | 複数ファイルの同時編集 |
| 設定画面 | フォントサイズ、テーマカラーなどのユーザー設定 |
| アプリアイコン | デフォルトの Tauri アイコンのまま |
| テスト | ユニットテスト / E2E テストの整備 |
| インストーラ配布 | 配布用インストーラの動作検証 |
