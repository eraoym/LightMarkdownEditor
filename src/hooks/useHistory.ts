import { useCallback, useRef, useState } from "react";

const MAX_HISTORY = 200;
const DEBOUNCE_MS = 500;

export function useHistory(initial: string) {
  const stack = useRef<string[]>([initial]);
  const cursor = useRef(0);
  const [value, setValue] = useState(initial);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<string | null>(null);

  const commitNow = useCallback((v: string) => {
    const top = stack.current[cursor.current];
    if (v === top) return;
    stack.current = stack.current.slice(0, cursor.current + 1);
    stack.current.push(v);
    if (stack.current.length > MAX_HISTORY) stack.current.shift();
    else cursor.current++;
  }, []);

  const flushPending = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    if (pending.current !== null) {
      commitNow(pending.current);
      pending.current = null;
    }
  }, [commitNow]);

  /** 通常タイピング用（デバウンスしてコミット） */
  const set = useCallback(
    (v: string) => {
      setValue(v);
      pending.current = v;
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        commitNow(v);
        pending.current = null;
        timer.current = null;
      }, DEBOUNCE_MS);
    },
    [commitNow]
  );

  /** ツールバー・Tab・括弧補完など、プログラム変更用（即時コミット） */
  const setImmediate = useCallback(
    (v: string) => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
      pending.current = null;
      setValue(v);
      commitNow(v);
    },
    [commitNow]
  );

  /** ファイルを開いたときなど、履歴ごとリセット */
  const reset = useCallback((v: string) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    pending.current = null;
    stack.current = [v];
    cursor.current = 0;
    setValue(v);
  }, []);

  const undo = useCallback(() => {
    // デバウンス中の変更があれば先にコミットしてから戻る
    flushPending();
    if (cursor.current > 0) {
      cursor.current--;
      setValue(stack.current[cursor.current]);
      return true;
    }
    return false;
  }, [flushPending]);

  const redo = useCallback(() => {
    if (cursor.current < stack.current.length - 1) {
      cursor.current++;
      setValue(stack.current[cursor.current]);
      return true;
    }
    return false;
  }, []);

  return { value, set, setImmediate, undo, redo, reset };
}
