import { forwardRef } from "react";
import { parseToMarkdownTable } from "../utils/parseTable";

interface EditorProps {
  value: string;
  onChange: (value: string) => void;
  onProgrammaticChange: (value: string) => void;
  onImagePaste?: (blob: Blob, start: number, end: number) => void;
  style?: React.CSSProperties;
  fontSize?: number;
  fontFamily?: string;
  tabWidth?: number;
}

const Editor = forwardRef<HTMLTextAreaElement, EditorProps>(function Editor(
  { value, onChange, onProgrammaticChange, onImagePaste, style, fontSize, fontFamily, tabWidth = 2 },
  ref
) {
  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    const el = e.currentTarget;
    const start = el.selectionStart;
    const end = el.selectionEnd;

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
    ...(style ?? { width: "100%" }),
    fontSize: fontSize ? `${fontSize}px` : undefined,
    fontFamily: fontFamily ?? undefined,
  };

  return (
    <textarea
      ref={ref}
      className="h-full resize-none p-4 font-mono leading-relaxed bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none"
      style={fontStyle}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={handleKeyDown}
      onPaste={handlePaste}
      placeholder="Markdown を入力..."
      spellCheck={false}
    />
  );
});

export default Editor;
