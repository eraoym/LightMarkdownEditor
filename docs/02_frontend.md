# 02 フロントエンド設計（React 19 + Tailwind v4）

> 最終更新: 2026-03-18（プレビューテーマ切替機能追加）

---

## 画面レイアウト

```text
┌──────────────────────────────────────────────────────────────────┐
│ [☰][開く]         [Split/TOC] [編集][プレビュー] [☀/🌙]         │ Header
├──────────────────────────────────────────────────────────────────┤
│ [+][tab1 ●×][tab2 ×]                                            │ TabBar
├──────────┬──────────────────────────┬─┬──────────────────────────┤
│          │ [B][I][H1]... (編集時)   │ │                          │ Toolbar
│ Explorer ├──────────────────────────┤ ├──────────────────────────┤
│ sidebar  │                          │▌│ Preview / TOC sidebar    │
│ (toggle) │  Editor                  │ │                          │
│          │                          │ │                          │
└──────────┴──────────────────────────┴─┴──────────────────────────┘
```

- ヘッダー左端に `☰` でエクスプローラーサイドバーのトグル
- タブバーで複数ファイルを同時編集可能
- エクスプローラーは左サイドバー（幅可変、初期 192px、min 160px / max 480px）、`☰` でトグル
- **スプリットプレビュー（編集モード時）**: `Split` ボタンでエディタ右にプレビューを横並び表示。ハンドルでリサイズ（幅は localStorage 永続化）
- **TOCサイドバー（プレビューモード時）**: `TOC` ボタンでプレビュー右に目次サイドバーを表示。ハンドルでリサイズ（幅は localStorage 永続化）
- サイドバー・ハンドルとも localStorage で幅永続化
- ウィンドウサイズも localStorage に保存し、起動時に復元

---

## ダークモード

Tailwind v4 クラスベースのダークモード（`@custom-variant dark (&:where(.dark, .dark *))`）を使用。

- 初期値: OS の `prefers-color-scheme` から取得
- `App` の `isDark` state でルート div の `dark` クラスを制御
- ヘッダーの ☀/🌙 ボタンで手動切替

---

## 使用ライブラリ

| ライブラリ | 用途 | インストール |
| --- | --- | --- |
| `react-markdown` | Markdown → React コンポーネントへの変換 | `pnpm add react-markdown` |
| `remark-gfm` | GitHub Flavored Markdown（テーブル、チェックボックスなど）の対応 | `pnpm add remark-gfm` |
| `mermaid` | mermaid コードブロックのダイアグラム描画 | `pnpm add mermaid` |
| `highlight.js` | コードブロックのシンタックスハイライト | `pnpm add highlight.js` |

> `react-markdown` は `dangerouslySetInnerHTML` を使わずに安全にレンダリングできるため採用。

---

## コンポーネント構成

```text
App
├── Header          ← ☰ ボタン、「開く」ボタン、Split/TOC トグル、モード切替、⚙/テーマ切替ボタン
├── TabBar          ← タブ一覧（+/×/未保存●）
├── div.flex
│   ├── Explorer    ← エクスプローラーサイドバー（☰ トグル）
│   └── div.flex-col
│       ├── Toolbar         ← フォーマットツールバー（EditMode 時のみ）
│       └── div.flex
│           ├── Editor      ← textarea（EditMode 時）
│           ├── [divider]   ← リサイズハンドル（スプリット時）
│           ├── Preview     ← react-markdown + hljs（EditMode スプリット時 or PreviewMode 時）
│           ├── [divider]   ← リサイズハンドル（TOC 表示時）
│           └── TocSidebar  ← 目次サイドバー（PreviewMode + TOC ON 時）
└── SettingsModal   ← 設定モーダル（isSettingsOpen 時）
```

### セッション永続化

起動時に前回開いていたタブとフォルダを自動復元する。

| キー | 内容 |
| --- | --- |
| `session_tabs` | `[{filePath}]` — ファイルパスのみ保存（内容は起動時に再読み込み） |
| `session_activeFilePath` | 前回アクティブだったファイルパス |
| `explorerPath` | 前回選択したフォルダパス |

- `filePath` がない（新規未保存）タブは保存しない
- ファイルが移動・削除されていた場合はそのタブをスキップ

### App（状態管理の中心）

```ts
// タブ・履歴管理（useTabs に移動）
const tabs = useTabs();

// App ローカル状態
const [mode, setMode] = useState<Mode>("edit");
const [isDark, setIsDark] = useState(...);
const [settings, setSettings] = useState<AppSettings>(...); // localStorage "app_settings" から初期化
const [isSettingsOpen, setIsSettingsOpen] = useState(false);
const [isExplorerOpen, setIsExplorerOpen] = useState(false);
const [sidebarWidth, setSidebarWidth] = useState(() => parseInt(localStorage.getItem("sidebarWidth") ?? "192"));
// スプリットプレビュー（編集モード時のみ有効）
const [isSplitPreview, setIsSplitPreview] = useState(false);
const [splitWidth, setSplitWidth] = useState(() => parseInt(localStorage.getItem("splitWidth") ?? "50"));
// TOCサイドバー（プレビューモード時のみ有効）
const [isTocOpen, setIsTocOpen] = useState(false);
const [tocWidth, setTocWidth] = useState(() => parseInt(localStorage.getItem("tocWidth") ?? "220"));
const textareaRef = useRef<HTMLTextAreaElement>(null);
```

### Header

| Props | 型 | 説明 |
| --- | --- | --- |
| `filePath` | `string \| null` | アクティブタブのファイルパス |
| `saveState` | `SaveState` | アクティブタブの保存状態 |
| `onOpen` | `() => void` | 「開く」ボタン押下ハンドラ |
| `mode` | `Mode` | 現在のモード |
| `onModeChange` | `(mode: Mode) => void` | モード切替ハンドラ |
| `isDark` | `boolean` | 現在のテーマ状態 |
| `onThemeToggle` | `() => void` | テーマ切替ハンドラ |
| `isExplorerOpen` | `boolean` | エクスプローラー表示状態 |
| `onExplorerToggle` | `() => void` | エクスプローラートグルハンドラ |
| `isSplitPreview` | `boolean` | スプリットプレビュー表示状態 |
| `onSplitPreviewToggle` | `() => void` | スプリットプレビュートグルハンドラ |
| `isTocOpen` | `boolean` | TOCサイドバー表示状態 |
| `onTocToggle` | `() => void` | TOCサイドバートグルハンドラ |
| `onSettingsOpen` | `() => void` | 設定モーダルを開くハンドラ |
| `onPrint` | `() => void` | PDF 印刷ハンドラ（PreviewMode 時に PDF ボタン表示） |

### SettingsModal

| Props | 型 | 説明 |
| --- | --- | --- |
| `settings` | `AppSettings` | 現在の設定値 |
| `onChange` | `(s: AppSettings) => void` | 設定変更ハンドラ |
| `onClose` | `() => void` | モーダルを閉じるハンドラ |

- `fixed inset-0 z-50` のオーバーレイ + 中央ダイアログ
- オーバーレイクリック or ✕ボタンで閉じる
- 設定項目: エディタフォントサイズ（スライダー 12〜20px）、フォントファミリー（セレクト）、タブ幅（2/4 ボタン）、プレビューテーマ（GitHub / Minimal / Academic）

### TabBar

| Props | 型 | 説明 |
| --- | --- | --- |
| `tabs` | `Readonly<TabData>[]` | タブ一覧 |
| `activeId` | `string` | アクティブタブの ID |
| `onNew` | `() => void` | 新規タブ作成 |
| `onSwitch` | `(id: string) => void` | タブ切替 |
| `onClose` | `(id: string) => void` | タブ閉じる（confirm 済み前提） |
| `onCloseOthers` | `(id: string) => void` | 他のタブをすべて閉じる（confirm 済み前提） |
| `onCloseAll` | `() => void` | すべてのタブを閉じる（confirm 済み前提） |

右クリックコンテキストメニューで「タブを閉じる」「他のタブをすべて閉じる」「すべてのタブを閉じる」を表示。メニュー外クリックで自動的に閉じる。

### Explorer

| Props | 型 | 説明 |
| --- | --- | --- |
| `onOpenFile` | `(path: string) => void` | ファイルクリック時のハンドラ |
| `width` | `number` | サイドバー幅（px）|

- フォルダ選択ボタン → `readDir` でツリー表示
- フォルダクリック → 遅延展開/折り畳み
- ファイルクリック → `onOpenFile` を呼び出し
- `width` props で動的幅対応（App から渡す、`style={{ width }}` で適用）

### TocSidebar

| Props | 型 | 説明 |
| --- | --- | --- |
| `markdown` | `string` | 目次抽出対象の Markdown テキスト |
| `width` | `number` | サイドバー幅（px）|

- `useMemo` で `markdown` が変わった時のみ見出しを再抽出
- `/^(#{1,6})\s+(.+)$/gm` で H1〜H6 を抽出
- 見出しレベルに応じて `paddingLeft: (level-1) * 12px` でインデント表示
- PreviewMode + `isTocOpen` の時のみ表示

### Toolbar

| Props | 型 | 説明 |
| --- | --- | --- |
| `actions` | `EditorActions` | `useEditorActions` が返すアクション群 |

ボタン一覧:

| ボタン | 記号 | 動作 |
|--------|------|------|
| Bold | **B** | 選択テキストを `**...**` で囲む |
| Italic | *I* | 選択テキストを `*...*` で囲む |
| H1 | H1 | 行頭に `# ` を付与/削除 |
| H2 | H2 | 行頭に `## ` を付与/削除 |
| H3 | H3 | 行頭に `### ` を付与/削除 |
| 箇条書き | `—` | 行頭に `- ` を付与/削除 |
| 番号リスト | `1.` | 行頭に `1. ` を付与/削除 |
| コード | `` ` `` | 選択テキストを `` `...` `` で囲む (選択なしでコードブロック) |

### Editor

| Props | 型 | 説明 |
| --- | --- | --- |
| `value` | `string` | 現在の Markdown テキスト |
| `onChange` | `(v: string) => void` | テキスト変更ハンドラ |
| `ref` | `RefObject<HTMLTextAreaElement>` | `forwardRef` で外部公開（useEditorActions が使用） |
| `fontSize` | `number \| undefined` | エディタフォントサイズ（px）|
| `fontFamily` | `string \| undefined` | エディタフォントファミリー |
| `tabWidth` | `2 \| 4` | タブ幅（スペース数、デフォルト 2）|

Editor の追加機能:
- `Tab` → `tabWidth` 分のスペースを挿入
- `Shift+Tab` → 行頭のスペースを `tabWidth` 分削除
- `(` / `[` / `` ` `` → 対応する閉じ記号を自動補完

### Preview

| Props | 型 | 説明 |
| --- | --- | --- |
| `markdown` | `string` | レンダリング対象の Markdown テキスト |
| `filePath` | `string \| null` | 現在開いているファイルパス（相対パス画像の解決に使用） |
| `isDark` | `boolean` | mermaid テーマの切替に使用 |
| `previewTheme` | `PreviewTheme` | プレビュー用テーマ（`github` / `minimal` / `academic`） |

- `img` カスタムレンダラーで相対パス画像を `readFile` + base64 変換してレンダリング
- `code` カスタムレンダラーで `language-mermaid` は `MermaidDiagram` で描画、それ以外のコードブロックは `highlight.js` でシンタックスハイライト
- バイナリファイルは `TEXT_EXTENSIONS` ホワイトリストで弾き、「表示できません」メッセージを表示（App.tsx で制御）
- コンテナに `print-area` クラスを付与し、`@media print` で他の要素を非表示にしてプレビュー内容のみ PDF 出力できる
- `MermaidDiagram` に `mermaid-diagram` クラスを付与し、SVG 背景を透明に上書きすることでライトモードの背景色問題を修正
- `previewTheme` に対応する CSS を `src/styles/themes/` から `?raw` インポートし、`<style>` タグとして注入することでテーマを切替。CSS 変数（`--tw-prose-*` / `--tw-prose-invert-*`）でライト/ダーク両対応

---

## hooks

### useTabs

多タブ対応の状態管理フック。`useHistory` を置き換える。

```ts
// タブデータはすべて useRef で保持し、tick で再描画をトリガー
export function useTabs(): UseTabsReturn
```

主要な返り値:
- `tabs`, `activeId`, `activeContent`, `activeFilePath`, `activeSaveState` — 描画用
- `newTab()`, `closeTab(id)`, `switchTab(id)`, `nextTab()`, `prevTab()` — タブ操作
- `findTabByPath(path)` — 同一ファイルの重複チェック
- `openFileInTab(path, content, targetId?)` — ファイルを特定タブに開く
- `setActiveContent(v)` — 500ms デバウンスでコミット（タイピング用）
- `setActiveContentImmediate(v)` — 即時コミット（ツールバー/Tab補完用）
- `undo()`, `redo()` — タブごとに独立した履歴

各タブは独立した履歴スタックを持つ（最大 200 エントリ）。

### useEditorActions

```ts
export function useEditorActions(
  textareaRef: RefObject<HTMLTextAreaElement | null>,
  markdown: string,
  setMarkdown: (v: string) => void
): EditorActions
```

内部関数:
- `wrapSelection(before, after)` — 選択範囲を記号で囲む
- `toggleLinePrefix(prefix)` — 行頭プレフィックスのトグル
- `insertAtCursor(text)` — カーソル位置にテキスト挿入

返す actions: `bold`, `italic`, `code`, `heading(1|2|3)`, `bulletList`, `orderedList`

---

## キーボードショートカット

`App` コンポーネントの `useEffect` で `keydown` イベントを登録する。

| ショートカット | 動作 |
| --- | --- |
| `Ctrl+S` | ファイル保存 |
| `Ctrl+B` | 太字（Bold） |
| `Ctrl+I` | 斜体（Italic） |
| `Ctrl+Z` | アンドゥ |
| `Ctrl+Y` | リドゥ |
| `Ctrl+Tab` | 次のタブへ切替 |
| `Ctrl+Shift+Tab` | 前のタブへ切替 |
| `Tab` | スペース2個挿入（Editor内） |
| `Shift+Tab` | 行頭スペース2個削除（Editor内） |

---

## Tailwind クラス設計

### App 全体のレイアウト

```tsx
<div className={`flex flex-col h-screen bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 ${isDark ? "dark" : ""}`}>
  <Header ... />
  <div className="flex flex-col flex-1 overflow-hidden">
    {mode === "edit" && (
      <>
        <Toolbar actions={editorActions} />
        <Editor ref={textareaRef} ... />
      </>
    )}
    {mode === "preview" && <Preview ... />}
  </div>
</div>
```

### Header

```tsx
<header className="flex items-center gap-3 px-4 h-10 border-b border-zinc-200 dark:border-zinc-700 shrink-0">
  <button className="text-sm px-3 py-1 rounded border border-zinc-300 dark:border-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800">
    開く
  </button>
  <span className="text-sm text-zinc-500 truncate flex-1">{fileName}</span>
  <span className="text-xs text-zinc-400">{saveLabel}</span>
  {/* モード切替トグル */}
  <div className="flex border border-zinc-300 dark:border-zinc-600 rounded overflow-hidden text-sm">
    <button>編集</button>
    <button>プレビュー</button>
  </div>
  {/* テーマ切替 */}
  <button className="text-sm px-2 py-1 rounded border ...">☀/🌙</button>
</header>
```

### Toolbar

```tsx
<div className="flex items-center gap-1 px-3 py-1 border-b border-zinc-200 dark:border-zinc-700 shrink-0">
  {/* ボタン群 */}
</div>
```

### Editor（EditMode 全画面）

```tsx
<textarea
  className="w-full h-full resize-none p-4 text-sm font-mono leading-relaxed
             bg-white dark:bg-zinc-900
             focus:outline-none"
/>
```

### Preview（PreviewMode 全画面）

```tsx
<div className="w-full h-full overflow-y-auto p-4 prose prose-zinc dark:prose-invert max-w-none" />
```

> `prose` クラスは `@tailwindcss/typography` プラグインが必要。追加インストール: `pnpm add -D @tailwindcss/typography`
> `src/index.css` に `@plugin "@tailwindcss/typography";` を追記する。

---

## ファイル構成

```text
src/
├── types.ts              # 共通型: TabData, SaveState, Mode, PreviewTheme, AppSettings, DEFAULT_SETTINGS
├── App.tsx               # 状態管理・キーボードショートカット・Tauri 呼び出し
├── components/
│   ├── Header.tsx        # ☰ / Split / TOC / ⚙ トグルボタン
│   ├── TabBar.tsx        # タブバー UI
│   ├── Explorer.tsx      # エクスプローラーサイドバー
│   ├── Editor.tsx        # forwardRef・Tab/括弧補完（fontSize/fontFamily/tabWidth props 対応）
│   ├── Toolbar.tsx       # フォーマットツールバー
│   ├── Preview.tsx       # highlight.js によるシンタックスハイライト統合
│   ├── SettingsModal.tsx # 設定モーダル（フォントサイズ・フォント・タブ幅）
│   └── TocSidebar.tsx    # 目次サイドバー（PreviewMode 用）
├── hooks/
│   ├── useTabs.ts           # 多タブ履歴管理フック
│   ├── useHistory.ts        # 旧履歴管理（未使用、削除保留）
│   └── useEditorActions.ts  # テキスト操作ロジック
├── styles/
│   ├── hljs-theme.css    # highlight.js GitHub テーマ（ライト/ダーク）
│   └── themes/
│       ├── github.css    # プレビューテーマ: GitHub スタイル
│       ├── minimal.css   # プレビューテーマ: Minimal（無彩色）
│       └── academic.css  # プレビューテーマ: Academic（暖色系）
└── index.css             # @custom-variant dark / hljs-theme.css インポート
```
