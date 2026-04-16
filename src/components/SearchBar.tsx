import type { SearchState } from "../types";

interface SearchBarProps {
  state: SearchState;
  onChange: (partial: Partial<SearchState>) => void;
  onNext: () => void;
  onPrev: () => void;
  onReplace: () => void;
  onReplaceAll: () => void;
  onClose: () => void;
  matchCount: number;
  regexError: string | null;
  inputRef: React.RefObject<HTMLInputElement | null>;
}

export default function SearchBar({
  state,
  onChange,
  onNext,
  onPrev,
  onReplace,
  onReplaceAll,
  onClose,
  matchCount,
  regexError,
  inputRef,
}: SearchBarProps) {
  const matchLabel =
    matchCount === 0
      ? "0 / 0"
      : `${state.currentMatchIndex + 1} / ${matchCount}`;

  function handleSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onNext();
    } else if (e.key === "Enter" && e.shiftKey) {
      e.preventDefault();
      onPrev();
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  }

  function handleReplaceKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      onReplace();
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  }

  const searchInputClass = [
    "text-sm px-2 py-0.5 rounded border w-52 focus:outline-none focus:ring-1 focus:ring-blue-500",
    regexError
      ? "border-red-400 dark:border-red-600 bg-red-50 dark:bg-red-950/20"
      : "border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-700",
    "text-zinc-900 dark:text-zinc-100",
  ].join(" ");

  return (
    <div className="absolute top-2 right-4 z-30 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 shadow-lg p-2 flex flex-col gap-1 min-w-80">
      {/* 1行目: 置換トグル + 検索ボックス + 操作ボタン */}
      <div className="flex items-center gap-1">
        {/* 置換エリア展開トグル */}
        <button
          title="置換エリアを展開/折りたたむ"
          onClick={() => onChange({ showReplace: !state.showReplace })}
          className="w-5 h-5 flex items-center justify-center text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-100 shrink-0"
        >
          {state.showReplace ? "▼" : "▶"}
        </button>

        {/* 検索テキストボックス */}
        <input
          ref={inputRef}
          type="text"
          placeholder="検索..."
          value={state.query}
          onChange={(e) => onChange({ query: e.target.value })}
          onKeyDown={handleSearchKeyDown}
          className={searchInputClass}
          autoFocus
        />

        {/* 正規表現切り替え */}
        <button
          title="正規表現を使用"
          onClick={() => onChange({ useRegex: !state.useRegex })}
          className={[
            "px-1.5 py-0.5 text-xs rounded border font-mono shrink-0",
            state.useRegex
              ? "bg-blue-600 border-blue-600 text-white"
              : "border-zinc-300 dark:border-zinc-600 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700",
          ].join(" ")}
        >
          .*
        </button>

        {/* マッチカウンター */}
        <span className="text-xs text-zinc-500 dark:text-zinc-400 min-w-12 text-center shrink-0">
          {matchLabel}
        </span>

        {/* 前マッチ */}
        <button
          title="前の一致 (Shift+Enter)"
          onClick={onPrev}
          disabled={matchCount === 0}
          className="w-6 h-6 flex items-center justify-center text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded disabled:opacity-40"
        >
          ∧
        </button>

        {/* 次マッチ */}
        <button
          title="次の一致 (Enter)"
          onClick={onNext}
          disabled={matchCount === 0}
          className="w-6 h-6 flex items-center justify-center text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded disabled:opacity-40"
        >
          ∨
        </button>

        {/* 閉じる */}
        <button
          title="閉じる (Escape)"
          onClick={onClose}
          className="w-6 h-6 flex items-center justify-center text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded shrink-0"
        >
          ✕
        </button>
      </div>

      {/* 2行目: 置換エリア（showReplace 時のみ） */}
      {state.showReplace && (
        <div className="flex items-center gap-1 pl-6">
          <input
            type="text"
            placeholder="置換後..."
            value={state.replaceText}
            onChange={(e) => onChange({ replaceText: e.target.value })}
            onKeyDown={handleReplaceKeyDown}
            className="text-sm px-2 py-0.5 rounded border w-52 border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <button
            onClick={onReplace}
            disabled={matchCount === 0}
            className="text-xs px-2 py-0.5 rounded border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 disabled:opacity-40 shrink-0"
          >
            置換
          </button>
          <button
            onClick={onReplaceAll}
            disabled={matchCount === 0}
            className="text-xs px-2 py-0.5 rounded border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 disabled:opacity-40 shrink-0"
          >
            全置換
          </button>
        </div>
      )}

      {/* 正規表現エラー */}
      {regexError && (
        <div className="pl-6 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 rounded px-2 py-0.5 border border-red-200 dark:border-red-800">
          無効な正規表現: {regexError}
        </div>
      )}
    </div>
  );
}
