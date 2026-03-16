import { useCallback, useEffect, useRef, useState } from "react";
import { open, save, confirm } from "@tauri-apps/plugin-dialog";
import { readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import { getCurrentWindow } from "@tauri-apps/api/window";
import Header from "./components/Header";
import Editor from "./components/Editor";
import Preview from "./components/Preview";
import Toolbar from "./components/Toolbar";
import TabBar from "./components/TabBar";
import Explorer from "./components/Explorer";
import { useEditorActions } from "./hooks/useEditorActions";
import { useTabs } from "./hooks/useTabs";
import type { Mode } from "./types";

export default function App() {
  const tabs = useTabs();
  const tabsRef = useRef(tabs);
  tabsRef.current = tabs;

  const [mode, setMode] = useState<Mode>("edit");
  const [isDark, setIsDark] = useState(() =>
    window.matchMedia("(prefers-color-scheme: dark)").matches
  );
  const [isExplorerOpen, setIsExplorerOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const editorActions = useEditorActions(
    textareaRef,
    tabs.activeContent,
    tabs.setActiveContentImmediate
  );
  const editorActionsRef = useRef(editorActions);
  editorActionsRef.current = editorActions;

  useEffect(() => {
    const filePath = tabsRef.current.activeFilePath;
    const fileName = filePath?.split(/[\\/]/).pop() ?? null;
    const title = fileName ? `${fileName} - light-md` : "light-md";
    getCurrentWindow().setTitle(title).catch(console.error);
  }, [tabs.activeFilePath]);

  const handleOpen = useCallback(async () => {
    const selected = await open({
      filters: [{ name: "Markdown", extensions: ["md", "txt"] }],
    });
    if (typeof selected !== "string") return;
    const existingId = tabsRef.current.findTabByPath(selected);
    if (existingId) {
      tabsRef.current.switchTab(existingId);
      return;
    }
    const content = await readTextFile(selected);
    const active = tabsRef.current.tabs.find(
      (t) => t.id === tabsRef.current.activeId
    )!;
    if (active.filePath === null && active.content === "") {
      tabsRef.current.openFileInTab(selected, content, active.id);
    } else {
      tabsRef.current.newTab();
      // openFileInTab は新しいタブ（末尾）をターゲットにする
      tabsRef.current.openFileInTab(selected, content);
    }
  }, []);

  const handleSave = useCallback(async () => {
    tabsRef.current.setActiveSaveState("saving");
    let targetPath = tabsRef.current.activeFilePath;

    if (!targetPath) {
      const chosen = await save({
        filters: [{ name: "Markdown", extensions: ["md"] }],
        defaultPath: "untitled.md",
      });
      if (!chosen) {
        tabsRef.current.setActiveSaveState("unsaved");
        return;
      }
      targetPath = chosen;
    }

    await writeTextFile(targetPath, tabsRef.current.activeContent);
    tabsRef.current.setActiveFilePath(targetPath);
    tabsRef.current.setActiveSaveState("saved");
  }, []);

  const handleCloseTab = useCallback(async (id: string) => {
    const tab = tabsRef.current.tabs.find((t) => t.id === id);
    if (tab?.saveState === "unsaved") {
      const label = tab.filePath?.split(/[\\/]/).pop() ?? "新規ファイル";
      const ok = await confirm(
        `「${label}」に未保存の変更があります。閉じますか？`,
        { title: "確認", kind: "warning" }
      );
      if (!ok) return;
    }
    tabsRef.current.closeTab(id);
  }, []);

  const handleOpenFileFromExplorer = useCallback(async (path: string) => {
    const existingId = tabsRef.current.findTabByPath(path);
    if (existingId) {
      tabsRef.current.switchTab(existingId);
      return;
    }
    const content = await readTextFile(path);
    const active = tabsRef.current.tabs.find(
      (t) => t.id === tabsRef.current.activeId
    )!;
    if (active.filePath === null && active.content === "") {
      tabsRef.current.openFileInTab(path, content, active.id);
    } else {
      tabsRef.current.newTab();
      tabsRef.current.openFileInTab(path, content);
    }
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      if (e.key === "s") {
        e.preventDefault();
        handleSave();
      } else if (e.key === "b") {
        e.preventDefault();
        editorActionsRef.current.bold();
      } else if (e.key === "i") {
        e.preventDefault();
        editorActionsRef.current.italic();
      } else if (e.key === "z") {
        e.preventDefault();
        tabsRef.current.undo();
      } else if (e.key === "y") {
        e.preventDefault();
        tabsRef.current.redo();
      } else if (e.key === "Tab" && !e.shiftKey) {
        e.preventDefault();
        tabsRef.current.nextTab();
      } else if (e.key === "Tab" && e.shiftKey) {
        e.preventDefault();
        tabsRef.current.prevTab();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleSave]);

  return (
    <div
      className={`flex flex-col h-screen bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 ${isDark ? "dark" : ""}`}
    >
      <Header
        filePath={tabs.activeFilePath}
        saveState={tabs.activeSaveState}
        onOpen={handleOpen}
        mode={mode}
        onModeChange={setMode}
        isDark={isDark}
        onThemeToggle={() => setIsDark((d) => !d)}
        isExplorerOpen={isExplorerOpen}
        onExplorerToggle={() => setIsExplorerOpen((v) => !v)}
      />
      <TabBar
        tabs={tabs.tabs}
        activeId={tabs.activeId}
        onNew={tabs.newTab}
        onSwitch={tabs.switchTab}
        onClose={handleCloseTab}
      />
      <div className="flex flex-1 overflow-hidden">
        <div className={isExplorerOpen ? "" : "hidden"}>
          <Explorer onOpenFile={handleOpenFileFromExplorer} />
        </div>
        <div className="flex flex-col flex-1 overflow-hidden">
          {mode === "edit" && (
            <>
              <Toolbar actions={editorActions} />
              <Editor
                ref={textareaRef}
                value={tabs.activeContent}
                onChange={tabs.setActiveContent}
                onProgrammaticChange={tabs.setActiveContentImmediate}
              />
            </>
          )}
          {mode === "preview" && <Preview markdown={tabs.activeContent} />}
        </div>
      </div>
    </div>
  );
}
