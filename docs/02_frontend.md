# 02 フロントエンド設計（React 19 + Tailwind v4）

> 最終更新: 2026-04-15（Issue #17: PDF 表示機能追加）

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
│   └── PdfViewer       ← PDF 参照専用ビューア（activeFileType === "pdf" 時）
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
- 起動時に保存済みファイルが1つ以上開けた場合、空の「新規ファイル」タブは自動除去（`pruneEmptyTabs`）
- 開けるタブが1つもなかった場合のみ、空タブを1つ保持

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
const [isDragOver, setIsDragOver] = useState(false);       // D&D オーバーレイ表示フラグ
const [dropFolder, setDropFolder] = useState<string | undefined>(undefined); // D&D でドロップされたフォルダ
const [sidebarWidth, setSidebarWidth] = useState(() => parseInt(localStorage.getItem("sidebarWidth") ?? "192"));
// スプリットプレビュー（編集モード時のみ有効）
const [isSplitPreview, setIsSplitPreview] = useState(false);
const [splitWidth, setSplitWidth] = useState(() => parseInt(localStorage.getItem("splitWidth") ?? "50"));
// TOCサイドバー（プレビューモード時のみ有効）
const [isTocOpen, setIsTocOpen] = useState(false);
const [tocWidth, setTocWidth] = useState(() => parseInt(localStorage.getItem("tocWidth") ?? "220"));
const textareaRef = useRef<HTMLTextAreaElement>(null);
```

### ドラッグ＆ドロップ

- **ウィンドウへのドロップ**: `onDragDropEvent` でファイル/フォルダを判別
  - ファイル → `handleOpenFileFromExplorer` でタブ開く
  - フォルダ → `dropFolder` state を更新 → Explorer に `initialFolder` として渡す + Explorer を開く
  - ドラッグ中は `isDragOver=true` → 全面オーバーレイ（青点線枠）を表示
- **アイコンへのドロップ（起動時引数）**: `invoke("get_startup_args")` で Rust から引数取得、セッション復元後にファイルを開く

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
| `version` | `string` | アプリバージョン文字列（`getVersion()` で取得、⚙ボタン左に `vX.Y.Z` 表示） |
| `isPdf` | `boolean` | アクティブタブが PDF ファイルの場合 `true`。モード切替（編集/プレビュー）・Split・TOC・印刷ボタンを無効化 |

### SettingsModal

| Props | 型 | 説明 |
| --- | --- | --- |
| `settings` | `AppSettings` | 現在の設定値 |
| `onChange` | `(s: AppSettings) => void` | 設定変更ハンドラ |
| `onClose` | `() => void` | モーダルを閉じるハンドラ |

- `fixed inset-0 z-50` のオーバーレイ + 中央ダイアログ
- オーバーレイクリック or ✕ボタンで閉じる
- 設定項目: エディタフォントサイズ（スライダー 12〜20px）、フォントファミリー（セレクト）、タブ幅（2/4 ボタン）、プレビューテーマ（GitHub / Minimal / Academic）、見出し番号付与の開始レベル（H1 / H2 ボタン）

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
| `onReorder` | `(fromIndex: number, toIndex: number) => void` | タブの並び替え（DnD） |

右クリックコンテキストメニューで「タブを閉じる」「他のタブをすべて閉じる」「すべてのタブを閉じる」を表示。メニュー外クリックで自動的に閉じる。

タブはドラッグ&ドロップで並び替え可能（HTML5 DnD API）。ドロップ先タブに青い左ボーダーを表示してドロップ位置を示す。並び替え後の順序はセッション保存に自動反映される。

### Explorer

| Props | 型 | 説明 |
| --- | --- | --- |
| `onOpenFile` | `(path: string) => void` | ファイルクリック時のハンドラ |
| `width` | `number` | サイドバー幅（px） |
| `initialFolder` | `string \| undefined` | 外部からフォルダを指定（D&D 等） |

- フォルダ選択ボタン → `open({ directory: true, defaultPath: rootPath })` で選択ダイアログを表示（現在のフォルダをデフォルトに：Issue #18）。選択後 `readDir` でツリー表示
- フォルダクリック → 遅延展開/折り畳み
- ファイルクリック → `onOpenFile` を呼び出し
- `width` props で動的幅対応（App から渡す、`style={{ width }}` で適用）
- `initialFolder` が変更されたとき `useEffect` で内部 rootPath を更新（D&D でフォルダをドロップした際に使用）
- **右クリックコンテキストメニュー**（Issue #16）:
  - ファイル右クリック → 「削除」
  - フォルダ右クリック → 「新しいファイル」「新しいフォルダ」「削除」
  - 背景右クリック → 「新しいファイル」「新しいフォルダ」（ルートに作成）
  - `confirm()` ダイアログで削除前に確認
- **インライン名前入力**（Issue #16）: ファイル/フォルダ作成時にツリー内に `<input>` を表示。`Enter` で確定、`Escape` / フォーカスアウトでキャンセル
- **ドラッグ&ドロップ移動**（Issue #16）: HTML5 D&D API でエクスプローラー内のファイル/フォルダを別フォルダへ移動（`rename` API 使用）。ドロップ先フォルダに青ハイライト表示。自己配下へのドロップは無効
- **リアルタイム更新**（Issue #16）: `setInterval`（2000ms）で `readDir` をポーリング。展開状態は `collectExpandedPaths` + `restoreExpanded` で保持。ファイル操作後は即時 `refreshTree()` で反映
- ロジックは `useExplorer` カスタムフック（`src/hooks/useExplorer.ts`）に集約し、Explorer.tsx はレンダリングのみ担当

### TocSidebar

| Props | 型 | 説明 |
| --- | --- | --- |
| `markdown` | `string` | 目次抽出対象の Markdown テキスト |
| `width` | `number` | サイドバー幅（px） |

- `useMemo` で `markdown` が変わった時のみ見出しを再抽出
- 抽出前に `stripFencedCodeBlocks()` でフェンスドコードブロックを除去してからマッチ（Issue #9 対応）
- `/^(#{1,6})\s+(.+)$/gm` で H1〜H6 を抽出
- 見出しレベルに応じて `paddingLeft: (level-1) * 12px` でインデント表示
- PreviewMode + `isTocOpen` の時のみ表示

### PdfViewer

| Props | 型 | 説明 |
| --- | --- | --- |
| `filePath` | `string` | 表示する PDF ファイルの絶対パス |

- `readFile`（`@tauri-apps/plugin-fs`）でバイナリ読み込み → `Blob` + `URL.createObjectURL` で Blob URL を生成
- `<iframe>` に渡して WebView2 のネイティブ PDF レンダリングを利用（新規 npm パッケージなし）
- タブ切替・コンポーネントアンマウント時に `URL.revokeObjectURL` で Blob URL を解放（メモリリーク防止）
- 読み込み中は「読み込み中...」、エラー時は「PDF を読み込めませんでした」を表示
- `activeFileType === "pdf"` の時のみ表示。Editor / Preview / Toolbar は非表示になる
- Ctrl+S は PDF タブでは無効（`handleSave` 冒頭で `activeFileType === "pdf"` をガード）
- ヘッダーのモード切替・Split・TOC・印刷ボタンは `isPdf` フラグで無効化

### Toolbar

| Props | 型 | 説明 |
| --- | --- | --- |
| `actions` | `EditorActions` | `useEditorActions` が返すアクション群 |

ボタン一覧:

| ボタン | 記号 | 動作 |
| ----- | ---- | ---- |
| Bold | **B** | 選択テキストを `**...**` で囲む |
| Italic | *I* | 選択テキストを `*...*` で囲む |
| H1 | H1 | 行頭に `#` を付与/削除 |
| H2 | H2 | 行頭に `##` を付与/削除 |
| H3 | H3 | 行頭に `###` を付与/削除 |
| 箇条書き | `—` | 行頭に `-` を付与/削除 |
| 番号リスト | `1.` | 行頭に `1.` を付与/削除 |
| コード | `` ` `` | 選択テキストを `` `...` `` で囲む (選択なしでコードブロック) |
| テーブル | `⊞` | 未選択: 2×2テンプレート挿入 / 選択時: カンマ区切りテキストを表に変換 |
| 見出し番号付与 | `№` | 全見出しに階層番号（`1.1.1` 形式）を付与/再付与（既存番号は除去して再付与） |

### Editor

| Props | 型 | 説明 |
| --- | --- | --- |
| `value` | `string` | 現在の Markdown テキスト |
| `onChange` | `(v: string) => void` | テキスト変更ハンドラ |
| `ref` | `RefObject<HTMLTextAreaElement>` | `forwardRef` で外部公開（useEditorActions が使用） |
| `fontSize` | `number \| undefined` | エディタフォントサイズ（px） |
| `fontFamily` | `string \| undefined` | エディタフォントファミリー |
| `tabWidth` | `2 \| 4` | タブ幅（スペース数、デフォルト 2） |

Editor の追加機能:

- `Enter` → リスト行（`-` / `*` で始まる行）: 次の行に同マーカーを継続挿入。空リスト行: マーカーを削除して通常改行に戻す。インデント行: 改行後も同じインデントを維持（DOM の `el.value` を直接参照し React state との非同期ズレを回避）
- `Tab` → 選択なし: カーソル位置に `tabWidth` 分のスペースを挿入。選択あり: 選択範囲に含まれる全行の先頭に `tabWidth` 分のスペースを挿入（同上）
- `Shift+Tab` → 行頭のスペースを `tabWidth` 分削除（同上）
- `Ctrl+Shift+V` → クリップボードのタブ区切りテキスト（Excel コピー形式）を Markdown テーブルとして貼り付け
- `Ctrl+Alt+V` → クリップボード内の画像をファイルとして貼り付け（テキストのみの場合は無効）。Ctrl+V での画像自動貼り付けは廃止（Issue #12 対応）
- `(` / `[` / `` ` `` → 対応する閉じ記号を自動補完

### Preview

| Props | 型 | 説明 |
| --- | --- | --- |
| `markdown` | `string` | レンダリング対象の Markdown テキスト |
| `filePath` | `string \| null` | 現在開いているファイルパス（相対パス画像の解決に使用） |
| `isDark` | `boolean` | mermaid テーマの切替に使用 |
| `previewTheme` | `PreviewTheme` | プレビュー用テーマ（`github` / `minimal` / `academic`） |
| `onCheckboxToggle` | `(index: number) => void \| undefined` | チェックボックスの n 番目がクリックされたときのコールバック |

- `img` カスタムレンダラーで相対パス画像を `readFile` + base64 変換してレンダリング
- GFM チェックボックスはカスタム `input` レンダラーで enabled として描画し、クリック時に `onCheckboxToggle(index)` を呼び出す（Issue #10 対応）
- `code` カスタムレンダラーで `language-mermaid` は `MermaidDiagram` で描画、それ以外のコードブロックは `highlight.js` でシンタックスハイライト
- バイナリファイルは `TEXT_EXTENSIONS` ホワイトリストで弾き、「表示できません」メッセージを表示（App.tsx で制御）
- コンテナに `print-area` クラスを付与し、`@media print` で他の要素を非表示にしてプレビュー内容のみ PDF 出力できる
- `@page` の `margin: 0 0 1.2cm` + `@bottom-center { content: counter(page) }` でページ番号を中央下部に表示（WebView2の"localhost:1420"フッタを置換）
- `.print-area hr` に `break-after: page` を指定することで、Markdown の `---` を改ページとして扱える
- `MermaidDiagram` に `mermaid-diagram` クラスを付与し、SVG 背景を透明に上書きすることでライトモードの背景色問題を修正
- `MermaidDiagram` の `useEffect` は `code`/`isDark` 変化時に前回描画をクリアしてから再描画し、アンマウント時にもキャンセル処理を行う（Issue #19 対応）
- `previewTheme` に対応する CSS を `src/styles/themes/` から `?raw` インポートし、`<style>` タグとして注入することでテーマを切替。CSS 変数（`--tw-prose-*` / `--tw-prose-invert-*`）でライト/ダーク両対応
- 文書先頭の YAML front matter（`---` ... `---` で囲まれたブロック）はプレビュー・目次の対象外とする（Issue #14 対応）
- `rehype-raw` プラグインにより Markdown 内の HTML タグをそのままレンダリング（Issue #15 対応）

---

## hooks

### useExplorer

エクスプローラーの状態管理・ファイル操作ロジックを集約するカスタムフック（Issue #16 対応）。

```ts
export function useExplorer(
  onOpenFile: (path: string) => void,
  initialFolder?: string
): UseExplorerReturn
```

主要な返り値:

- `rootPath`, `tree` — ツリー表示用
- `contextMenu`, `inlineInput`, `dragState`, `dropTargetPath` — UI 状態
- `handleSelectFolder()` — フォルダ選択ダイアログ
- `handleToggleNode(node)` — 展開/折り畳み・ファイルを開く
- `handleContextMenu(e, node?)` — 右クリックメニューを開く
- `handleContextMenuAction(action)` — メニュー操作（`"new-file"` / `"new-folder"` / `"delete"`）
- `handleInlineChange(value)`, `handleInlineCommit()`, `handleInlineCancel()` — インライン入力
- `handleDragStart/Over/Leave/End/Drop` — D&D ハンドラ

ポーリング用 `setInterval`（2000ms）は `rootPath` が変わるたびに再登録される。  
stale closure 対策として `treeRef: useRef<TreeNode[]>` で最新ツリーを保持する。

### useTabs

多タブ対応の状態管理フック。`useHistory` を置き換える。

```ts
// タブデータはすべて useRef で保持し、tick で再描画をトリガー
export function useTabs(): UseTabsReturn
```

主要な返り値:

- `tabs`, `activeId`, `activeContent`, `activeFilePath`, `activeSaveState`, `activeFileType` — 描画用
- `newTab()`, `closeTab(id)`, `switchTab(id)`, `nextTab()`, `prevTab()` — タブ操作
- `findTabByPath(path)` — 同一ファイルの重複チェック
- `openFileInTab(path, content, targetId?, fileType?)` — ファイルを特定タブに開く（`fileType` は `"text"` / `"pdf"` / `"unsupported"`）
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

返す actions: `bold`, `italic`, `code`, `heading(1|2|3)`, `bulletList`, `orderedList`, `table`, `insertAtCursor`

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
| `Enter` | リスト行: 次の行に同マーカーを継続。空リスト行: マーカー削除して通常改行。インデント行: インデントを維持（Editor内） |
| `Tab` | 選択なし: スペースを tabWidth 分挿入。選択あり: 選択全行の先頭にスペースを tabWidth 分挿入（Editor内） |
| `Shift+Tab` | 行頭スペースを tabWidth 分削除（Editor内） |
| `Ctrl+Shift+V` | クリップボードのタブ区切りテキストを Markdown テーブルとして貼り付け |
| `Ctrl+Alt+V` | クリップボード内の画像をファイルとして貼り付け |
| `Ctrl+;` | 現在の日付を `YYYY/M/D` 形式でカーソル位置に挿入 |
| `Ctrl+:` | 現在の時刻を `hh:mm` 形式でカーソル位置に挿入 |

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
├── types.ts              # 共通型: TabData, SaveState, Mode, PreviewTheme, FileType, AppSettings, DEFAULT_SETTINGS
├── App.tsx               # 状態管理・キーボードショートカット・Tauri 呼び出し
├── components/
│   ├── Header.tsx        # ☰ / Split / TOC / ⚙ トグルボタン
│   ├── TabBar.tsx        # タブバー UI
│   ├── Explorer.tsx      # エクスプローラーサイドバー
│   ├── Editor.tsx        # forwardRef・Tab/括弧補完（fontSize/fontFamily/tabWidth props 対応）
│   ├── Toolbar.tsx       # フォーマットツールバー
│   ├── Preview.tsx       # highlight.js によるシンタックスハイライト統合
│   ├── SettingsModal.tsx # 設定モーダル（フォントサイズ・フォント・タブ幅）
│   ├── TocSidebar.tsx    # 目次サイドバー（PreviewMode 用）
│   └── PdfViewer.tsx     # PDF 参照専用ビューア（Issue #17）
├── hooks/
│   ├── useTabs.ts           # 多タブ履歴管理フック
│   ├── useHistory.ts        # 旧履歴管理（未使用、削除保留）
│   ├── useEditorActions.ts  # テキスト操作ロジック
│   └── useExplorer.ts       # エクスプローラー状態管理・ファイル操作ロジック（Issue #16）
├── utils/
│   └── parseTable.ts        # CSV/TSV → Markdown テーブル変換ユーティリティ
├── styles/
│   ├── hljs-theme.css    # highlight.js GitHub テーマ（ライト/ダーク）
│   └── themes/
│       ├── github.css    # プレビューテーマ: GitHub スタイル
│       ├── minimal.css   # プレビューテーマ: Minimal（無彩色）
│       └── academic.css  # プレビューテーマ: Academic（暖色系）
└── index.css             # @custom-variant dark / hljs-theme.css インポート
```
