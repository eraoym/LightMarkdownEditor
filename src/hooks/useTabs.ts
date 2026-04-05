import { useCallback, useRef, useState } from "react";
import type { TabData, SaveState } from "../types";

const MAX_HISTORY = 200;
const DEBOUNCE_MS = 500;

let tabIdCounter = 0;
function genId() {
  return `tab-${++tabIdCounter}`;
}

function createEmptyTab(): TabData {
  return {
    id: genId(),
    filePath: null,
    content: "",
    saveState: "saved",
    historyStack: [""],
    historyCursor: 0,
    historyPending: null,
    historyTimer: null,
  };
}

function commitNow(tab: TabData, v: string) {
  const top = tab.historyStack[tab.historyCursor];
  if (v === top) return;
  tab.historyStack = tab.historyStack.slice(0, tab.historyCursor + 1);
  tab.historyStack.push(v);
  if (tab.historyStack.length > MAX_HISTORY) tab.historyStack.shift();
  else tab.historyCursor++;
}

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

  newTab: () => void;
  closeTab: (id: string) => void;
  closeOtherTabs: (id: string) => void;
  closeAllTabs: () => void;
  switchTab: (id: string) => void;
  nextTab: () => void;
  prevTab: () => void;
  findTabByPath: (p: string) => string | undefined;
  openFileInTab: (path: string, content: string, targetId?: string) => void;
  pruneEmptyTabs: () => void;

  setActiveContent: (v: string) => void;
  setActiveContentImmediate: (v: string) => void;
  setActiveSaveState: (s: SaveState) => void;
  setActiveFilePath: (p: string) => void;
  undo: () => boolean;
  redo: () => boolean;
}

export function useTabs(): UseTabsReturn {
  const tabsDataRef = useRef<TabData[]>([createEmptyTab()]);
  const activeIdRef = useRef<string>(tabsDataRef.current[0].id);
  const [, setTick] = useState(0);
  const bump = useCallback(() => setTick((t) => t + 1), []);

  const getActive = () =>
    tabsDataRef.current.find((t) => t.id === activeIdRef.current)!;

  const newTab = useCallback(() => {
    const tab = createEmptyTab();
    tabsDataRef.current = [...tabsDataRef.current, tab];
    activeIdRef.current = tab.id;
    bump();
  }, [bump]);

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

  const closeAllTabs = useCallback(() => {
    for (const tab of tabsDataRef.current) {
      if (tab.historyTimer) clearTimeout(tab.historyTimer);
    }
    const empty = createEmptyTab();
    tabsDataRef.current = [empty];
    activeIdRef.current = empty.id;
    bump();
  }, [bump]);

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

  const nextTab = useCallback(() => {
    const tabs = tabsDataRef.current;
    const idx = tabs.findIndex((t) => t.id === activeIdRef.current);
    const nextIdx = (idx + 1) % tabs.length;
    switchTab(tabs[nextIdx].id);
  }, [switchTab]);

  const prevTab = useCallback(() => {
    const tabs = tabsDataRef.current;
    const idx = tabs.findIndex((t) => t.id === activeIdRef.current);
    const prevIdx = (idx - 1 + tabs.length) % tabs.length;
    switchTab(tabs[prevIdx].id);
  }, [switchTab]);

  const findTabByPath = useCallback((p: string) => {
    return tabsDataRef.current.find((t) => t.filePath === p)?.id;
  }, []);

  const openFileInTab = useCallback(
    (path: string, content: string, targetId?: string) => {
      const tabs = tabsDataRef.current;
      const id = targetId ?? activeIdRef.current;
      const tab = tabs.find((t) => t.id === id);
      if (!tab) return;

      if (tab.historyTimer) clearTimeout(tab.historyTimer);
      tab.filePath = path;
      tab.content = content;
      tab.saveState = "saved";
      tab.historyStack = [content];
      tab.historyCursor = 0;
      tab.historyPending = null;
      tab.historyTimer = null;

      activeIdRef.current = id;
      bump();
    },
    [bump]
  );

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
    setActiveContent,
    setActiveContentImmediate,
    setActiveSaveState,
    setActiveFilePath,
    undo,
    redo,
  };
}
