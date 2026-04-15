import { useCallback, useRef, useState } from "react";
import type { TabData, SaveState, FileType } from "../types";

/** 履歴スタックの最大保持件数 */
const MAX_HISTORY = 200;
/** タイピング入力を履歴にコミットするまでのデバウンス時間（ms） */
const DEBOUNCE_MS = 500;

/** タブID生成用の連番カウンター */
let tabIdCounter = 0;
/** タブに一意なIDを生成して返す */
function genId() {
  return `tab-${++tabIdCounter}`;
}

/** 空の新規タブデータを初期値付きで生成する */
function createEmptyTab(): TabData {
  return {
    id: genId(),
    filePath: null,
    content: "",
    saveState: "saved",
    fileType: "text",
    historyStack: [""],
    historyCursor: 0,
    historyPending: null,
    historyTimer: null,
  };
}

/**
 * 現在値を履歴スタックに即時コミットする（デバウンスなし）
 * 同一値の場合は何もしない。MAX_HISTORY を超えた場合は最古エントリを削除する
 * @param tab - 対象タブデータ（破壊的に更新）
 * @param v - コミットする文字列
 */
function commitNow(tab: TabData, v: string) {
  const top = tab.historyStack[tab.historyCursor];
  if (v === top) return;
  tab.historyStack = tab.historyStack.slice(0, tab.historyCursor + 1);
  tab.historyStack.push(v);
  if (tab.historyStack.length > MAX_HISTORY) tab.historyStack.shift();
  else tab.historyCursor++;
}

/**
 * デバウンス中の保留エントリを今すぐ履歴に確定させる
 * タブ切替やアンドゥ前など、タイマー待ちを避けたい操作の前処理として使用する
 * @param tab - 対象タブデータ（破壊的に更新）
 */
function flushPending(tab: TabData) {
  if (tab.historyTimer) {
    clearTimeout(tab.historyTimer);
    tab.historyTimer = null;
  }
  if (tab.historyPending !== null) {
    commitNow(tab, tab.historyPending);
    tab.historyPending = null;
  }
}

export interface UseTabsReturn {
  tabs: Readonly<TabData>[];
  activeId: string;
  activeContent: string;
  activeFilePath: string | null;
  activeSaveState: SaveState;
  activeFileType: FileType;

  newTab: () => string;
  closeTab: (id: string) => void;
  closeOtherTabs: (id: string) => void;
  closeAllTabs: () => void;
  switchTab: (id: string) => void;
  nextTab: () => void;
  prevTab: () => void;
  findTabByPath: (p: string) => string | undefined;
  openFileInTab: (path: string, content: string, targetId?: string, fileType?: FileType) => void;
  pruneEmptyTabs: () => void;
  reorderTabs: (fromIndex: number, toIndex: number) => void;

  setActiveContent: (v: string) => void;
  setActiveContentImmediate: (v: string) => void;
  setActiveSaveState: (s: SaveState) => void;
  setActiveFilePath: (p: string) => void;
  undo: () => boolean;
  redo: () => boolean;
}

/**
 * タブの開閉・切替・コンテンツ更新・履歴管理を提供するフック
 * タブデータは `useRef` で管理し、`bump()` で強制再レンダリングする設計
 */
export function useTabs(): UseTabsReturn {
  const tabsDataRef = useRef<TabData[]>([createEmptyTab()]);
  const activeIdRef = useRef<string>(tabsDataRef.current[0].id);
  const [, setTick] = useState(0);
  const bump = useCallback(() => setTick((t) => t + 1), []);

  /** 現在アクティブなタブデータを返す内部ヘルパー */
  const getActive = () =>
    tabsDataRef.current.find((t) => t.id === activeIdRef.current)!;

  /**
   * 新しい空タブを末尾に追加しアクティブにする
   * @returns 追加したタブのID
   */
  const newTab = useCallback(() => {
    const tab = createEmptyTab();
    tabsDataRef.current = [...tabsDataRef.current, tab];
    activeIdRef.current = tab.id;
    bump();
    return tab.id;
  }, [bump]);

  /** ファイル未設定かつ内容空の空タブを一括削除する（起動時セッション復元後の初期タブ除去に使用） */
  const pruneEmptyTabs = useCallback(() => {
    const tabs = tabsDataRef.current;
    const nonEmpty = tabs.filter(
      (t) => !(t.filePath === null && t.content === "" && t.saveState === "saved")
    );
    if (nonEmpty.length === 0 || nonEmpty.length === tabs.length) return;
    for (const tab of tabs) {
      if (!nonEmpty.includes(tab) && tab.historyTimer) {
        clearTimeout(tab.historyTimer);
      }
    }
    if (!nonEmpty.find((t) => t.id === activeIdRef.current)) {
      activeIdRef.current = nonEmpty[nonEmpty.length - 1].id;
    }
    tabsDataRef.current = nonEmpty;
    bump();
  }, [bump]);

  /**
   * ドラッグ操作によるタブの並び替えを反映する
   * @param fromIndex - 移動元インデックス
   * @param toIndex - 移動先インデックス
   */
  const reorderTabs = useCallback((fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return;
    const tabs = [...tabsDataRef.current];
    const [moved] = tabs.splice(fromIndex, 1);
    tabs.splice(toIndex, 0, moved);
    tabsDataRef.current = tabs;
    bump();
  }, [bump]);

  /**
   * 指定タブを閉じる。タブが1枚だけの場合は空タブに差し替える
   * @param id - 閉じるタブのID
   */
  const closeTab = useCallback(
    (id: string) => {
      const tabs = tabsDataRef.current;
      const tab = tabs.find((t) => t.id === id);
      if (!tab) return;
      if (tab.historyTimer) clearTimeout(tab.historyTimer);

      let newTabs = tabs.filter((t) => t.id !== id);
      if (newTabs.length === 0) {
        newTabs = [createEmptyTab()];
      }

      if (activeIdRef.current === id) {
        activeIdRef.current = newTabs[newTabs.length - 1].id;
      }
      tabsDataRef.current = newTabs;
      bump();
    },
    [bump]
  );

  /**
   * 指定タブ以外をすべて閉じる
   * @param id - 残すタブのID
   */
  const closeOtherTabs = useCallback(
    (id: string) => {
      for (const tab of tabsDataRef.current) {
        if (tab.id !== id && tab.historyTimer) clearTimeout(tab.historyTimer);
      }
      const remaining = tabsDataRef.current.filter((t) => t.id === id);
      const newTabs = remaining.length > 0 ? remaining : [createEmptyTab()];
      activeIdRef.current = newTabs[0].id;
      tabsDataRef.current = newTabs;
      bump();
    },
    [bump]
  );

  /** 全タブを閉じて空タブ1枚に戻す */
  const closeAllTabs = useCallback(() => {
    for (const tab of tabsDataRef.current) {
      if (tab.historyTimer) clearTimeout(tab.historyTimer);
    }
    const empty = createEmptyTab();
    tabsDataRef.current = [empty];
    activeIdRef.current = empty.id;
    bump();
  }, [bump]);

  /**
   * アクティブタブを切り替える（切替前に保留中の履歴エントリを確定させる）
   * @param id - 切り替え先タブのID
   */
  const switchTab = useCallback(
    (id: string) => {
      const current = getActive();
      if (current) flushPending(current);
      activeIdRef.current = id;
      bump();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [bump]
  );

  /** タブを循環的に次へ切り替える */
  const nextTab = useCallback(() => {
    const tabs = tabsDataRef.current;
    const idx = tabs.findIndex((t) => t.id === activeIdRef.current);
    const nextIdx = (idx + 1) % tabs.length;
    switchTab(tabs[nextIdx].id);
  }, [switchTab]);

  /** タブを循環的に前へ切り替える */
  const prevTab = useCallback(() => {
    const tabs = tabsDataRef.current;
    const idx = tabs.findIndex((t) => t.id === activeIdRef.current);
    const prevIdx = (idx - 1 + tabs.length) % tabs.length;
    switchTab(tabs[prevIdx].id);
  }, [switchTab]);

  /**
   * ファイルパスからタブIDを検索する
   * @param p - 検索するファイルパス
   * @returns 見つかったタブID、なければ `undefined`
   */
  const findTabByPath = useCallback((p: string) => {
    return tabsDataRef.current.find((t) => t.filePath === p)?.id;
  }, []);

  /**
   * 指定タブにファイル内容をロードし履歴をリセットする
   * @param path - ロードするファイルパス
   * @param content - ファイルの文字列内容
   * @param targetId - ロード先タブのID（省略時はアクティブタブ）
   */
  const openFileInTab = useCallback(
    (path: string, content: string, targetId?: string, fileType: FileType = "text") => {
      const tabs = tabsDataRef.current;
      const id = targetId ?? activeIdRef.current;
      const tab = tabs.find((t) => t.id === id);
      if (!tab) return;

      if (tab.historyTimer) clearTimeout(tab.historyTimer);
      tab.filePath = path;
      tab.content = content;
      tab.saveState = "saved";
      tab.fileType = fileType;
      tab.historyStack = [content];
      tab.historyCursor = 0;
      tab.historyPending = null;
      tab.historyTimer = null;

      activeIdRef.current = id;
      bump();
    },
    [bump]
  );

  /**
   * エディタ内容を更新し、デバウンス付きで履歴にコミットする（通常タイピング用）
   * @param v - 新しいエディタ内容
   */
  const setActiveContent = useCallback(
    (v: string) => {
      const tab = getActive();
      if (!tab) return;
      tab.content = v;
      tab.saveState = "unsaved";
      tab.historyPending = v;
      if (tab.historyTimer) clearTimeout(tab.historyTimer);
      tab.historyTimer = setTimeout(() => {
        commitNow(tab, v);
        tab.historyPending = null;
        tab.historyTimer = null;
      }, DEBOUNCE_MS);
      bump();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [bump]
  );

  /**
   * エディタ内容を即時更新し履歴に即コミットする（チェックボックス・ツールバー等のプログラム変更用）
   * @param v - 新しいエディタ内容
   */
  const setActiveContentImmediate = useCallback(
    (v: string) => {
      const tab = getActive();
      if (!tab) return;
      if (tab.historyTimer) clearTimeout(tab.historyTimer);
      tab.historyTimer = null;
      tab.historyPending = null;
      tab.content = v;
      tab.saveState = "unsaved";
      commitNow(tab, v);
      bump();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [bump]
  );

  /**
   * アクティブタブの保存状態を更新する
   * @param s - 新しい保存状態
   */
  const setActiveSaveState = useCallback(
    (s: SaveState) => {
      const tab = getActive();
      if (!tab) return;
      tab.saveState = s;
      bump();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [bump]
  );

  /**
   * アクティブタブのファイルパスを更新する
   * @param p - 新しいファイルパス
   */
  const setActiveFilePath = useCallback(
    (p: string) => {
      const tab = getActive();
      if (!tab) return;
      tab.filePath = p;
      bump();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [bump]
  );

  /**
   * アクティブタブの履歴を1ステップ戻す
   * @returns 戻した場合は `true`、これ以上戻れない場合は `false`
   */
  const undo = useCallback(() => {
    const tab = getActive();
    if (!tab) return false;
    flushPending(tab);
    if (tab.historyCursor > 0) {
      tab.historyCursor--;
      tab.content = tab.historyStack[tab.historyCursor];
      tab.saveState = "unsaved";
      bump();
      return true;
    }
    return false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bump]);

  /**
   * アクティブタブの履歴を1ステップ進める
   * @returns 進めた場合は `true`、これ以上進めない場合は `false`
   */
  const redo = useCallback(() => {
    const tab = getActive();
    if (!tab) return false;
    if (tab.historyCursor < tab.historyStack.length - 1) {
      tab.historyCursor++;
      tab.content = tab.historyStack[tab.historyCursor];
      tab.saveState = "unsaved";
      bump();
      return true;
    }
    return false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bump]);

  const active = getActive();

  return {
    tabs: tabsDataRef.current,
    activeId: activeIdRef.current,
    activeContent: active?.content ?? "",
    activeFilePath: active?.filePath ?? null,
    activeSaveState: active?.saveState ?? "saved",
    activeFileType: active?.fileType ?? "text",
    newTab,
    closeTab,
    closeOtherTabs,
    closeAllTabs,
    switchTab,
    nextTab,
    prevTab,
    findTabByPath,
    openFileInTab,
    pruneEmptyTabs,
    reorderTabs,
    setActiveContent,
    setActiveContentImmediate,
    setActiveSaveState,
    setActiveFilePath,
    undo,
    redo,
  };
}
