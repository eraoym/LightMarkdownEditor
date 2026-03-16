import type { SaveState, Mode } from "../types";

interface HeaderProps {
  filePath: string | null;
  saveState: SaveState;
  onOpen: () => void;
  mode: Mode;
  onModeChange: (mode: Mode) => void;
  isDark: boolean;
  onThemeToggle: () => void;
  isExplorerOpen: boolean;
  onExplorerToggle: () => void;
}

export default function Header({
  filePath,
  saveState,
  onOpen,
  mode,
  onModeChange,
  isDark,
  onThemeToggle,
  isExplorerOpen,
  onExplorerToggle,
}: HeaderProps) {
  const fileName = filePath
    ? (filePath.split(/[\\/]/).pop() ?? filePath)
    : "新規ファイル";

  const saveLabel =
    saveState === "unsaved"
      ? "●"
      : saveState === "saving"
      ? "保存中..."
      : "";

  return (
    <header className="flex items-center gap-3 px-4 h-10 border-b border-zinc-200 dark:border-zinc-700 shrink-0">
      <button
        onClick={onExplorerToggle}
        title="エクスプローラーを切替"
        className={`text-sm px-2 py-1 rounded border border-zinc-300 dark:border-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 ${isExplorerOpen ? "bg-zinc-200 dark:bg-zinc-700" : ""}`}
      >
        ☰
      </button>
      <button
        onClick={onOpen}
        className="text-sm px-3 py-1 rounded border border-zinc-300 dark:border-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800"
      >
        開く
      </button>
      <span className="text-sm text-zinc-500 truncate flex-1">{fileName}</span>
      <span className="text-xs text-zinc-400">{saveLabel}</span>
      <div className="flex border border-zinc-300 dark:border-zinc-600 rounded overflow-hidden text-sm">
        <button
          onClick={() => onModeChange("edit")}
          className={mode === "edit" ? "bg-zinc-200 dark:bg-zinc-700 px-3 py-1" : "px-3 py-1 hover:bg-zinc-100 dark:hover:bg-zinc-800"}
        >
          編集
        </button>
        <button
          onClick={() => onModeChange("preview")}
          className={mode === "preview" ? "bg-zinc-200 dark:bg-zinc-700 px-3 py-1" : "px-3 py-1 hover:bg-zinc-100 dark:hover:bg-zinc-800"}
        >
          プレビュー
        </button>
      </div>
      <button
        onClick={onThemeToggle}
        title={isDark ? "ライトモードに切替" : "ダークモードに切替"}
        className="text-sm px-2 py-1 rounded border border-zinc-300 dark:border-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800"
      >
        {isDark ? "☀" : "🌙"}
      </button>
    </header>
  );
}
