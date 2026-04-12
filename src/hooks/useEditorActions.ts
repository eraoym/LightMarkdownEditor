import { RefObject, useEffect, useRef } from "react";
import { parseToMarkdownTable } from "../utils/parseTable";

export interface EditorActions {
  bold: () => void;
  italic: () => void;
  code: () => void;
  heading: (level: 1 | 2 | 3) => void;
  bulletList: () => void;
  orderedList: () => void;
  table: () => void;
  insertAtCursor: (text: string) => void;
  renewHeadingNumbers: () => void;
}

/**
 * エディタのMarkdown編集アクション群を提供するフック
 * ツールバーやキーボードショートカットから呼び出す
 * @param textareaRef - エディタの `<textarea>` への ref
 * @param _markdown - 現在のMarkdown内容（選択範囲保存のトリガーとして使用）
 * @param setMarkdown - Markdown内容を更新するコールバック
 * @param headingNumberStart - 見出し番号を付与し始めるレベル（1 or 2）
 */
export function useEditorActions(
  textareaRef: RefObject<HTMLTextAreaElement | null>,
  _markdown: string,
  setMarkdown: (v: string) => void,
  headingNumberStart: 1 | 2 = 1,
): EditorActions {
  // selectionchange で常に最新の選択範囲を保存する
  // → ツールバークリックでフォーカスが外れても正しい位置を取得できる
  const savedSel = useRef({ start: 0, end: 0 });

  // エディタがフォーカスを持つ間、selectionchange イベントで選択範囲をキャッシュする
  useEffect(() => {
    /** エディタがアクティブな場合のみ選択範囲を savedSel に保存する */
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

  function insertTable() {
    const el = textareaRef.current;
    if (!el) return;
    const { start, end } = getSel();
    const current = el.value;
    const selected = current.slice(start, end);

    let tableText: string;
    if (selected.trim().length === 0) {
      // ケース1: 未選択 → テンプレート挿入
      tableText = "| 列1 | 列2 |\n| --- | --- |\n| セル | セル |";
    } else {
      // ケース2: 選択範囲をカンマ区切りで変換
      tableText = parseToMarkdownTable(selected, ",");
    }

    const newText = current.slice(0, start) + tableText + current.slice(end);
    setMarkdown(newText);
    requestAnimationFrame(() => {
      el.focus();
      if (selected.trim().length === 0) {
        el.setSelectionRange(start + 2, start + 4); // "列1" を選択
      } else {
        el.setSelectionRange(start, start + tableText.length);
      }
    });
  }

  /**
   * カーソル位置（または選択範囲）に任意テキストを挿入する
   * @param text - 挿入するテキスト
   */
  function insertAtCursor(text: string) {
    const el = textareaRef.current;
    if (!el) return;
    const { start, end } = getSel();
    const current = el.value;
    const newText = current.slice(0, start) + text + current.slice(end);
    setMarkdown(newText);
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + text.length;
      el.setSelectionRange(pos, pos);
    });
  }

  function renewHeadingNumbers() {
    const el = textareaRef.current;
    if (!el) return;
    const lines = el.value.split("\n");
    const counters = [0, 0, 0, 0, 0, 0];
    let inCodeBlock = false;

    const newLines = lines.map((line) => {
      if (line.startsWith("```")) {
        inCodeBlock = !inCodeBlock;
        return line;
      }
      if (inCodeBlock) return line;

      const m = line.match(/^(#{1,6})\s+(.+)$/);
      if (!m) return line;

      const level = m[1].length;
      const rawText = m[2];
      // "1 ", "1.1 ", "1.1.1 " 形式の既存番号を除去
      const cleanText = rawText.replace(/^(\d+\.)*\d+\s+/, "");

      const relLevel = level - headingNumberStart + 1;
      if (relLevel < 1) return line;

      counters[relLevel - 1]++;
      for (let i = relLevel; i < 6; i++) counters[i] = 0;

      const numStr = counters.slice(0, relLevel).join(".");
      return `${"#".repeat(level)} ${numStr} ${cleanText}`;
    });

    setMarkdown(newLines.join("\n"));
  }

  return {
    bold: () => wrapSelection("**", "**"),
    italic: () => wrapSelection("*", "*"),
    code,
    heading: (level) => toggleLinePrefix("#".repeat(level) + " "),
    bulletList: () => toggleLinePrefix("- "),
    orderedList: () => toggleLinePrefix("1. "),
    table: insertTable,
    insertAtCursor,
    renewHeadingNumbers,
  };
}
