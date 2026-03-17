import { forwardRef } from "react";

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
        const lineStart = value.lastIndexOf("\n", start - 1) + 1;
        if (value.slice(lineStart).startsWith(indent)) {
          const newValue = value.slice(0, lineStart) + value.slice(lineStart + tabWidth);
          onProgrammaticChange(newValue);
          requestAnimationFrame(() => {
            el.setSelectionRange(Math.max(lineStart, start - tabWidth), Math.max(lineStart, end - tabWidth));
          });
        } else if (value.slice(lineStart).startsWith(" ")) {
          const newValue = value.slice(0, lineStart) + value.slice(lineStart + 1);
          onProgrammaticChange(newValue);
          requestAnimationFrame(() => {
            el.setSelectionRange(Math.max(lineStart, start - 1), Math.max(lineStart, end - 1));
          });
        }
      } else {
        // Tab: スペースを tabWidth 分挿入
        const newValue = value.slice(0, start) + indent + value.slice(end);
        onProgrammaticChange(newValue);
        requestAnimationFrame(() => {
          el.setSelectionRange(start + tabWidth, start + tabWidth);
        });
      }
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

  function handlePaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    if (!onImagePaste) return;
    const imageItem = Array.from(e.clipboardData.items).find((item) =>
      item.type.startsWith("image/")
    );
    if (!imageItem) return;
    const blob = imageItem.getAsFile();
    if (!blob) return;
    e.preventDefault();
    const start = e.currentTarget.selectionStart;
    const end = e.currentTarget.selectionEnd;
    onImagePaste(blob, start, end);
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
