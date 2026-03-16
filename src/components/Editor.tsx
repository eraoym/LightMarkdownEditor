import { forwardRef } from "react";

interface EditorProps {
  value: string;
  onChange: (value: string) => void;
  onProgrammaticChange: (value: string) => void;
}

const Editor = forwardRef<HTMLTextAreaElement, EditorProps>(function Editor(
  { value, onChange, onProgrammaticChange },
  ref
) {
  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    const el = e.currentTarget;
    const start = el.selectionStart;
    const end = el.selectionEnd;

    if (e.key === "Tab") {
      e.preventDefault();
      if (e.shiftKey) {
        // Shift+Tab: 行頭のスペース2個削除
        const lineStart = value.lastIndexOf("\n", start - 1) + 1;
        if (value.slice(lineStart).startsWith("  ")) {
          const newValue = value.slice(0, lineStart) + value.slice(lineStart + 2);
          onProgrammaticChange(newValue);
          requestAnimationFrame(() => {
            el.setSelectionRange(Math.max(lineStart, start - 2), Math.max(lineStart, end - 2));
          });
        } else if (value.slice(lineStart).startsWith(" ")) {
          const newValue = value.slice(0, lineStart) + value.slice(lineStart + 1);
          onProgrammaticChange(newValue);
          requestAnimationFrame(() => {
            el.setSelectionRange(Math.max(lineStart, start - 1), Math.max(lineStart, end - 1));
          });
        }
      } else {
        // Tab: スペース2個挿入
        const newValue = value.slice(0, start) + "  " + value.slice(end);
        onProgrammaticChange(newValue);
        requestAnimationFrame(() => {
          el.setSelectionRange(start + 2, start + 2);
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

  return (
    <textarea
      ref={ref}
      className="w-full h-full resize-none p-4 text-sm font-mono leading-relaxed bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={handleKeyDown}
      placeholder="Markdown を入力..."
      spellCheck={false}
    />
  );
});

export default Editor;
