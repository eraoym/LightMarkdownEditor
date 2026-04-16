import { forwardRef } from "react";
import { parseToMarkdownTable } from "../utils/parseTable";
import type { SearchState } from "../types";
import SearchBar from "./SearchBar";

interface EditorProps {
  value: string;
  onChange: (value: string) => void;
  onProgrammaticChange: (value: string) => void;
  onImagePaste?: (blob: Blob, start: number, end: number) => void;
  style?: React.CSSProperties;
  fontSize?: number;
  fontFamily?: string;
  tabWidth?: number;
  // 検索関連
  searchState?: SearchState;
  matchCount?: number;
  onSearchChange?: (partial: Partial<SearchState>) => void;
  onSearchNext?: () => void;
  onSearchPrev?: () => void;
  onSearchReplace?: () => void;
  onSearchReplaceAll?: () => void;
  onSearchClose?: () => void;
  searchRegexError?: string | null;
  searchInputRef?: React.RefObject<HTMLInputElement | null>;
}

const Editor = forwardRef<HTMLTextAreaElement, EditorProps>(function Editor(
  {
    value,
    onChange,
    onProgrammaticChange,
    onImagePaste,
    style,
    fontSize,
    fontFamily,
    tabWidth = 2,
    searchState,
    matchCount = 0,
    onSearchChange,
    onSearchNext,
    onSearchPrev,
    onSearchReplace,
    onSearchReplaceAll,
    onSearchClose,
    searchRegexError,
    searchInputRef,
  },
  ref
) {
  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    const el = e.currentTarget;
    const start = el.selectionStart;
    const end = el.selectionEnd;

    // 検索バー表示中: Enter で次マッチ、Escape で閉じる
    if (searchState?.isOpen) {
      if (e.key === "Enter" && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        if (e.shiftKey) {
          onSearchPrev?.();
        } else {
          onSearchNext?.();
        }
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        onSearchClose?.();
        return;
      }
    }

    if (e.key === "Enter" && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
      const text = el.value;
      const lineStart = text.lastIndexOf("\n", start - 1) + 1;
      const lineEnd = text.indexOf("\n", start);
      const lineEndPos = lineEnd === -1 ? text.length : lineEnd;
      const currentLine = text.slice(lineStart, lineEndPos);

      // ケース1: リスト行（先頭の空白 + [- or *] + 半角スペース + 本文）
      const listMatch = currentLine.match(/^(\s*)([-*]) (.*)/);
      if (listMatch) {
        const [, indent, marker, content] = listMatch;
        e.preventDefault();
        if (content.trim() === "") {
          // 空リスト項目: マーカーを削除して通常改行に戻す
          const markerStart = lineStart + indent.length;
          const afterLine = lineEnd === -1 ? "" : text.slice(lineEnd);
          const newValue = text.slice(0, markerStart) + afterLine;
          onProgrammaticChange(newValue);
          requestAnimationFrame(() => {
            el.setSelectionRange(markerStart, markerStart);
          });
        } else {
          // 非空リスト項目: 次の行に同じプレフィックスを挿入
          const prefix = "\n" + indent + marker + " ";
          const newValue = text.slice(0, start) + prefix + text.slice(end);
          onProgrammaticChange(newValue);
          const newPos = start + prefix.length;
          requestAnimationFrame(() => {
            el.setSelectionRange(newPos, newPos);
          });
        }
        return;
      }

      // ケース2: インデントのみの行（リストマーカーなし）
      const indentMatch = currentLine.match(/^(\s+)/);
      if (indentMatch) {
        e.preventDefault();
        const preserved = indentMatch[1];
        const newValue = text.slice(0, start) + "\n" + preserved + text.slice(end);
        onProgrammaticChange(newValue);
        const newPos = start + 1 + preserved.length;
        requestAnimationFrame(() => {
          el.setSelectionRange(newPos, newPos);
        });
        return;
      }
    }

    if (e.key === "Tab" && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      const indent = " ".repeat(tabWidth);
      if (e.shiftKey) {
        // Shift+Tab: 行頭のスペースを tabWidth 分削除
        const lineStart = el.value.lastIndexOf("\n", start - 1) + 1;
        if (el.value.slice(lineStart).startsWith(indent)) {
          const newValue = el.value.slice(0, lineStart) + el.value.slice(lineStart + tabWidth);
          onProgrammaticChange(newValue);
          requestAnimationFrame(() => {
            el.setSelectionRange(Math.max(lineStart, start - tabWidth), Math.max(lineStart, end - tabWidth));
          });
        } else if (el.value.slice(lineStart).startsWith(" ")) {
          const newValue = el.value.slice(0, lineStart) + el.value.slice(lineStart + 1);
          onProgrammaticChange(newValue);
          requestAnimationFrame(() => {
            el.setSelectionRange(Math.max(lineStart, start - 1), Math.max(lineStart, end - 1));
          });
        }
      } else if (start !== end) {
        // Tab（選択あり）: 選択範囲に含まれる全行の先頭にインデント挿入
        const text = el.value;
        const firstLineStart = text.lastIndexOf("\n", start - 1) + 1;
        const selectedContent = text.slice(firstLineStart, end);
        const lines = selectedContent.split("\n");
        // 選択終端がちょうど行頭の場合、その行はインデントしない
        const lastLineEmpty = lines[lines.length - 1] === "";
        const linesToIndent = lastLineEmpty ? lines.slice(0, -1) : lines;
        const indentedLines = linesToIndent.map((line) => indent + line);
        const newSection = lastLineEmpty
          ? [...indentedLines, ""].join("\n")
          : indentedLines.join("\n");
        const newValue = text.slice(0, firstLineStart) + newSection + text.slice(end);
        onProgrammaticChange(newValue);
        const addedChars = tabWidth * linesToIndent.length;
        requestAnimationFrame(() => {
          el.setSelectionRange(start + tabWidth, end + addedChars);
        });
      } else {
        // Tab（選択なし）: カーソル位置にインデント挿入
        const newValue = el.value.slice(0, start) + indent + el.value.slice(end);
        onProgrammaticChange(newValue);
        requestAnimationFrame(() => {
          el.setSelectionRange(start + tabWidth, start + tabWidth);
        });
      }
      return;
    }

    if (e.key.toLowerCase() === "v" && e.ctrlKey && e.shiftKey) {
      e.preventDefault();
      navigator.clipboard.readText().then((text) => {
        if (!text.trim()) return;
        const isTabDelimited = text.includes("\t");
        if (!isTabDelimited) return;
        const tableText = parseToMarkdownTable(text, "\t");
        const current = el.value;
        const newValue = current.slice(0, start) + tableText + current.slice(end);
        onProgrammaticChange(newValue);
        requestAnimationFrame(() => {
          el.setSelectionRange(start, start + tableText.length);
        });
      });
      return;
    }

    if (e.key.toLowerCase() === "v" && e.ctrlKey && e.altKey) {
      e.preventDefault();
      navigator.clipboard.read().then((clipboardItems) => {
        for (const clipboardItem of clipboardItems) {
          const imageType = clipboardItem.types.find((t) => t.startsWith("image/"));
          if (imageType) {
            clipboardItem.getType(imageType).then((blob) => {
              onImagePaste?.(blob, start, end);
            });
            break;
          }
        }
      }).catch(() => {});
      return;
    }

    // 括弧・記号の自動補完
    const pairs: Record<string, string> = {
      "(": ")",
      "[": "]",
      "`": "`",
    };
    if (pairs[e.key] && start === end) {
      e.preventDefault();
      const close = pairs[e.key];
      const newValue = value.slice(0, start) + e.key + close + value.slice(end);
      onProgrammaticChange(newValue);
      requestAnimationFrame(() => {
        el.setSelectionRange(start + 1, start + 1);
      });
    }
  }

  function handlePaste(_e: React.ClipboardEvent<HTMLTextAreaElement>) {
    // 画像の自動貼り付けは廃止。明示的な画像貼り付けは Ctrl+Alt+V で行う
  }

  const fontStyle: React.CSSProperties = {
    fontSize: fontSize ? `${fontSize}px` : undefined,
    fontFamily: fontFamily ?? undefined,
  };
  // wrapper div に style を適用（split プレビューの width 指定を含む）
  // style が未指定（split オフ）の場合は flex: 1 でフレックス親を埋める
  const wrapperStyle: React.CSSProperties = style ?? { flex: 1 };

  return (
    <div className="relative h-full" style={wrapperStyle}>
      {/* 検索バー */}
      {searchState?.isOpen && onSearchChange && (
        <SearchBar
          state={searchState}
          onChange={onSearchChange}
          onNext={onSearchNext ?? (() => {})}
          onPrev={onSearchPrev ?? (() => {})}
          onReplace={onSearchReplace ?? (() => {})}
          onReplaceAll={onSearchReplaceAll ?? (() => {})}
          onClose={onSearchClose ?? (() => {})}
          matchCount={matchCount}
          regexError={searchRegexError ?? null}
          inputRef={searchInputRef ?? { current: null }}
        />
      )}

      {/* エディタ本体: 現在マッチは setSelectionRange でブラウザネイティブ選択表示 */}
      <textarea
        ref={ref}
        className="absolute inset-0 h-full resize-none p-4 font-mono leading-relaxed bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none"
        style={fontStyle}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        placeholder="Markdown を入力..."
        spellCheck={false}
      />
    </div>
  );
});

export default Editor;
