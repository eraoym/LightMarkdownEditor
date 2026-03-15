# 02 フロントエンド設計（React 19 + Tailwind v4）

> 最終更新: 2026-03-16

---

## 画面レイアウト

EditMode と PreviewMode をヘッダーのトグルで切り替える。各モードは全画面幅で表示される。

```text
┌─────────────────────────────────────────────────────┐
│  [開く]  ファイル名.md  ●   [編集] [プレビュー]      │  ← ヘッダーバー（高さ固定）
├─────────────────────────────────────────────────────┤
│                                                     │
│   Markdown 入力（EditMode）                          │
│   または                                            │
│   HTML プレビュー（PreviewMode）                     │
│                                                     │
└─────────────────────────────────────────────────────┘
```

- ヘッダーに「編集」「プレビュー」のセグメントトグルを配置
- アクティブなモードはボタンをハイライト表示（`bg-zinc-200 dark:bg-zinc-700`）
- 各モードは全幅（`w-full`）・全高（`h-full`）で表示

---

## 使用ライブラリ

| ライブラリ | 用途 | インストール |
| --- | --- | --- |
| `react-markdown` | Markdown → React コンポーネントへの変換 | `pnpm add react-markdown` |
| `remark-gfm` | GitHub Flavored Markdown（テーブル、チェックボックスなど）の対応 | `pnpm add remark-gfm` |

> `react-markdown` は `dangerouslySetInnerHTML` を使わずに安全にレンダリングできるため採用。

---

## コンポーネント構成

```text
App
├── Header          ← 「開く」ボタン、ファイル名表示、保存状態、モード切替トグル
├── Editor          ← textarea（EditMode 時に全画面表示）
└── Preview         ← react-markdown（PreviewMode 時に全画面表示）
```

### App（状態管理の中心）

```ts
type SaveState = "saved" | "unsaved" | "saving";
type Mode = "edit" | "preview";

// 管理する状態
const [markdown, setMarkdown] = useState<string>("");
const [filePath, setFilePath] = useState<string | null>(null); // null = 未保存の新規
const [saveState, setSaveState] = useState<SaveState>("saved");
const [mode, setMode] = useState<Mode>("edit");
```

### Header

| Props | 型 | 説明 |
| --- | --- | --- |
| `filePath` | `string \| null` | 表示するファイルパス（null なら「新規ファイル」） |
| `saveState` | `SaveState` | 保存状態の表示切替 |
| `onOpen` | `() => void` | 「開く」ボタン押下ハンドラ |
| `mode` | `Mode` | 現在のモード（アクティブボタンのハイライトに使用） |
| `onModeChange` | `(mode: Mode) => void` | モード切替ハンドラ |

### Editor

| Props | 型 | 説明 |
| --- | --- | --- |
| `value` | `string` | 現在の Markdown テキスト |
| `onChange` | `(v: string) => void` | テキスト変更ハンドラ |

### Preview

| Props | 型 | 説明 |
| --- | --- | --- |
| `markdown` | `string` | レンダリング対象の Markdown テキスト |

---

## キーボードショートカット

`App` コンポーネントの `useEffect` で `keydown` イベントを登録する。

```ts
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "s") {
      e.preventDefault();
      handleSave();
    }
  };
  window.addEventListener("keydown", handleKeyDown);
  return () => window.removeEventListener("keydown", handleKeyDown);
}, [filePath, markdown]);
```

---

## Tailwind クラス設計

### App 全体のレイアウト

```tsx
<div className="flex flex-col h-screen bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100">
  <Header ... />
  <div className="flex flex-1 overflow-hidden">
    {mode === "edit" && <Editor ... />}
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
    <button className={mode === "edit" ? "bg-zinc-200 dark:bg-zinc-700 px-3 py-1" : "px-3 py-1 hover:bg-zinc-100 dark:hover:bg-zinc-800"}>
      編集
    </button>
    <button className={mode === "preview" ? "bg-zinc-200 dark:bg-zinc-700 px-3 py-1" : "px-3 py-1 hover:bg-zinc-100 dark:hover:bg-zinc-800"}>
      プレビュー
    </button>
  </div>
</header>
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

## ファイル構成（変更対象）

```text
src/
├── App.tsx           # 状態管理・キーボードショートカット・Tauri 呼び出し
├── components/
│   ├── Header.tsx
│   ├── Editor.tsx
│   └── Preview.tsx
└── index.css         # @plugin 追記
```
