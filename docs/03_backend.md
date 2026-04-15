# 03 バックエンド設計（Tauri ファイル操作）

> 最終更新: 2026-03-15

---

## 使用する Tauri プラグイン

Tauri v2 ではファイル操作・ダイアログは標準プラグインとして分離されている。

| プラグイン | 用途 |
| --- | --- |
| `tauri-plugin-fs` | ファイルの読み込み・書き込み・stat |
| `tauri-plugin-dialog` | ファイルを開く / 保存先を選ぶダイアログ |

---

## インストール

### Rust 側（Cargo.toml）

```toml
[dependencies]
tauri-plugin-fs = "2"
tauri-plugin-dialog = "2"
```

### JS 側

```powershell
pnpm add @tauri-apps/plugin-fs @tauri-apps/plugin-dialog
```

---

## Rust 側の初期化（src-tauri/src/lib.rs）

```rust
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

> ファイル読み書きとダイアログは JS 側の API を直接呼ぶため、カスタム `#[tauri::command]` は不要。

---

## パーミッション設定（capabilities/default.json）

プラグインの API を有効化するには `capabilities/default.json` への追記が必要。

```json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "default",
  "description": "default capability",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "opener:default",
    "fs:allow-read-text-file",
    "fs:allow-write-text-file",
    "fs:allow-exists",
    "dialog:allow-open",
    "dialog:allow-save"
  ]
}
```

---

## フロントエンドからの呼び出し設計

### ファイルを開く

```ts
import { open } from "@tauri-apps/plugin-dialog";
import { readTextFile } from "@tauri-apps/plugin-fs";

async function openFile(): Promise<{ path: string; content: string } | null> {
  const explorerPath = localStorage.getItem("explorerPath");
  const path = await open({
    filters: [{ name: "Markdown", extensions: ["md", "txt"] }],
    defaultPath: explorerPath ?? undefined, // 現在開いているフォルダをデフォルトに（Issue #18）
  });
  if (!path) return null; // キャンセル時

  const content = await readTextFile(path);
  return { path, content };
}
```

### ファイルを保存する

```ts
import { save } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";

// filePath が null = 新規ファイル → ダイアログを出す
async function saveFile(filePath: string | null, content: string): Promise<string | null> {
  let targetPath = filePath;

  if (!targetPath) {
    const explorerPath = localStorage.getItem("explorerPath");
    targetPath = await save({
      filters: [{ name: "Markdown", extensions: ["md"] }],
      defaultPath: explorerPath ? `${explorerPath}/untitled.md` : "untitled.md", // 現在開いているフォルダをデフォルトに（Issue #18）
    });
    if (!targetPath) return null; // キャンセル時
  }

  await writeTextFile(targetPath, content);
  return targetPath;
}
```

---

## App.tsx での組み合わせ

```ts
// 「開く」ボタン
const handleOpen = async () => {
  const result = await openFile();
  if (!result) return;
  setMarkdown(result.content);
  setFilePath(result.path);
  setSaveState("saved");
};

// Ctrl+S
const handleSave = async () => {
  setSaveState("saving");
  const savedPath = await saveFile(filePath, markdown);
  if (savedPath) {
    setFilePath(savedPath);
    setSaveState("saved");
  } else {
    setSaveState("unsaved"); // キャンセルされた場合
  }
};
```

---

## データフロー

```
[開くボタン]
    │
    ▼
dialog::open()  →  fs::readTextFile()
                         │
                         ▼
                   setMarkdown()  →  Editor + Preview に反映

[Ctrl+S]
    │
    ├─ filePath あり → fs::writeTextFile(filePath, markdown)
    │
    └─ filePath なし → dialog::save() → fs::writeTextFile(newPath, markdown)
                                              │
                                              ▼
                                        setFilePath(newPath)
```

---

## ウィンドウタイトルの更新

ファイルを開いた・保存したタイミングでウィンドウタイトルにファイル名を反映する。

```ts
import { getCurrentWindow } from "@tauri-apps/api/window";

// ファイル名だけ取り出す（パスの末尾）
const fileName = filePath?.split(/[\\/]/).pop() ?? "新規ファイル";
await getCurrentWindow().setTitle(`${fileName} — Light Markdown Editor`);
```

---

## ドラッグ＆ドロップ

### ウィンドウへのドロップ

`onDragDropEvent` でウィンドウにドロップされたファイル／フォルダを処理する。

```ts
getCurrentWindow().onDragDropEvent(async (event) => {
  if (event.payload.type === "drop") {
    for (const path of event.payload.paths) {
      const info = await stat(path);
      if (info.isDirectory) {
        // Explorer にフォルダをセット
      } else {
        // タブでファイルを開く
      }
    }
  }
});
```

- `enter` / `over` イベント: ドロップオーバーレイ表示（`isDragOver` state）
- `leave` イベント: オーバーレイ非表示
- `drop` イベント: `stat` でファイル/フォルダを判別

必要なパーミッション: `fs:allow-stat`（`tauri.conf.json` のウィンドウ設定変更は不要）

### アイコンへのドロップ（起動時引数）

Rust のカスタムコマンドで `std::env::args()` を返す。

```rust
#[tauri::command]
fn get_startup_args() -> Vec<String> {
    std::env::args()
        .skip(1) // バイナリパスをスキップ
        .filter(|a| !a.starts_with('-'))
        .collect()
}
```

フロントエンドからは `invoke("get_startup_args")` で取得し、セッション復元後（300ms遅延）にファイルを開く。

---

## 変更対象ファイル一覧

| ファイル | 変更内容 |
| --- | --- |
| `src-tauri/Cargo.toml` | `tauri-plugin-fs`, `tauri-plugin-dialog` を追加 |
| `src-tauri/src/lib.rs` | 2プラグインの `.plugin()` 登録 + `get_startup_args` コマンド |
| `src-tauri/capabilities/default.json` | fs / dialog / stat のパーミッション追加 |
| `src/App.tsx` | `openFile` / `saveFile` 呼び出しロジック + D&D 処理 |
| `package.json` (pnpm) | `@tauri-apps/plugin-fs`, `@tauri-apps/plugin-dialog` 追加 |
