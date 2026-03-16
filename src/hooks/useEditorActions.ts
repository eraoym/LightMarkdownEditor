import { RefObject, useEffect, useRef } from "react";

export interface EditorActions {
  bold: () => void;
  italic: () => void;
  code: () => void;
  heading: (level: 1 | 2 | 3) => void;
  bulletList: () => void;
  orderedList: () => void;
}

export function useEditorActions(
  textareaRef: RefObject<HTMLTextAreaElement | null>,
  _markdown: string,
  setMarkdown: (v: string) => void
): EditorActions {
  // selectionchange で常に最新の選択範囲を保存する
  // → ツールバークリックでフォーカスが外れても正しい位置を取得できる
  const savedSel = useRef({ start: 0, end: 0 });

  useEffect(() => {
    const handler = () => {
      const el = textareaRef.current;
      if (el && document.activeElement === el) {
        savedSel.current = { start: el.selectionStart, end: el.selectionEnd };
      }
    };
    document.addEventListener("selectionchange", handler);
    return () => document.removeEventListener("selectionchange", handler);
  }, [textareaRef]);

  function getSel() {
    const el = textareaRef.current;
    if (!el) return savedSel.current;
    // フォーカスがあれば直接読む、なければ保存済みを使う
    return document.activeElement === el
      ? { start: el.selectionStart, end: el.selectionEnd }
      : savedSel.current;
  }

  function wrapSelection(before: string, after: string) {
    const el = textareaRef.current;
    if (!el) return;
    const { start, end } = getSel();
    // el.value を直接読む（React state の更新タイミング差を回避）
    const current = el.value;
    const selected = current.slice(start, end);
    const newText = current.slice(0, start) + before + selected + after + current.slice(end);
    setMarkdown(newText);
    requestAnimationFrame(() => {
      el.focus();
      if (selected.length === 0) {
        const pos = start + before.length;
        el.setSelectionRange(pos, pos);
      } else {
        el.setSelectionRange(start + before.length, end + before.length);
      }
    });
  }

  function toggleLinePrefix(prefix: string) {
    const el = textareaRef.current;
    if (!el) return;
    const { start } = getSel();
    const current = el.value;
    const lineStart = current.lastIndexOf("\n", start - 1) + 1;
    const lineText = current.slice(lineStart);
    const lineEnd = lineText.indexOf("\n");
    const line = lineEnd === -1 ? lineText : lineText.slice(0, lineEnd);

    let newText: string;
    let newCursor: number;
    if (line.startsWith(prefix)) {
      newText =
        current.slice(0, lineStart) +
        line.slice(prefix.length) +
        current.slice(lineStart + line.length);
      newCursor = Math.max(lineStart, start - prefix.length);
    } else {
      newText =
        current.slice(0, lineStart) + prefix + line + current.slice(lineStart + line.length);
      newCursor = start + prefix.length;
    }
    setMarkdown(newText);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(newCursor, newCursor);
    });
  }

  function insertAtCursor(text: string) {
    const el = textareaRef.current;
    if (!el) return;
    const { start } = getSel();
    const current = el.value;
    const newText = current.slice(0, start) + text + current.slice(start);
    setMarkdown(newText);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + text.length, start + text.length);
    });
  }

  function code() {
    const el = textareaRef.current;
    if (!el) return;
    const { start, end } = getSel();
    if (start === end) {
      const current = el.value;
      const block = "```\n\n```";
      const newText = current.slice(0, start) + block + current.slice(start);
      setMarkdown(newText);
      requestAnimationFrame(() => {
        el.focus();
        const pos = start + 4; // ``` と改行の後
        el.setSelectionRange(pos, pos);
      });
    } else {
      wrapSelection("`", "`");
    }
  }

  return {
    bold: () => wrapSelection("**", "**"),
    italic: () => wrapSelection("*", "*"),
    code,
    heading: (level) => toggleLinePrefix("#".repeat(level) + " "),
    bulletList: () => toggleLinePrefix("- "),
    orderedList: () => toggleLinePrefix("1. "),
  };
}
