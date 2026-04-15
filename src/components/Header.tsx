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
  isSplitPreview: boolean;
  onSplitPreviewToggle: () => void;
  isTocOpen: boolean;
  onTocToggle: () => void;
  onSettingsOpen: () => void;
  onPrint: () => void;
  version: string;
  isPdf: boolean;
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
  isSplitPreview,
  onSplitPreviewToggle,
  isTocOpen,
  onTocToggle,
  onSettingsOpen,
  onPrint,
  version,
  isPdf,
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
          onClick={() => !isPdf && onModeChange("edit")}
          disabled={isPdf}
          className={[
            "px-3 py-1",
            isPdf ? "opacity-40 cursor-not-allowed" : "hover:bg-zinc-100 dark:hover:bg-zinc-800",
            mode === "edit" && !isPdf ? "bg-zinc-200 dark:bg-zinc-700" : "",
          ].join(" ")}
        >
          編集
        </button>
        <button
          onClick={() => !isPdf && onModeChange("preview")}
          disabled={isPdf}
          className={[
            "px-3 py-1",
            isPdf ? "opacity-40 cursor-not-allowed" : "hover:bg-zinc-100 dark:hover:bg-zinc-800",
            mode === "preview" && !isPdf ? "bg-zinc-200 dark:bg-zinc-700" : "",
          ].join(" ")}
        >
          プレビュー
        </button>
      </div>
      {mode === "edit" && !isPdf && (
        <button
          onClick={onSplitPreviewToggle}
          title="スプリットプレビューを切替"
          className={`text-sm px-2 py-1 rounded border border-zinc-300 dark:border-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 ${isSplitPreview ? "bg-zinc-200 dark:bg-zinc-700" : ""}`}
        >
          Split
        </button>
      )}
      {mode === "preview" && !isPdf && (
        <button
          onClick={onTocToggle}
          title="目次サイドバーを切替"
          className={`text-sm px-2 py-1 rounded border border-zinc-300 dark:border-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 ${isTocOpen ? "bg-zinc-200 dark:bg-zinc-700" : ""}`}
        >
          TOC
        </button>
      )}
      {mode === "preview" && !isPdf && (
        <button
          onClick={onPrint}
          title="PDFとして印刷"
          className="text-sm px-2 py-1 rounded border border-zinc-300 dark:border-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800"
        >
          PDF
        </button>
      )}
      {version && (
        <span className="text-xs text-zinc-400">v{version}</span>
      )}
      <button
        onClick={onSettingsOpen}
        title="設定"
        className="text-sm px-2 py-1 rounded border border-zinc-300 dark:border-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800"
      >
        ⚙
      </button>
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
