import { useCallback, useEffect, useRef, useState } from "react";
import { open, save, confirm } from "@tauri-apps/plugin-dialog";
import { readTextFile, writeTextFile, writeFile, mkdir } from "@tauri-apps/plugin-fs";
import { getCurrentWindow, LogicalSize } from "@tauri-apps/api/window";
import Header from "./components/Header";
import Editor from "./components/Editor";
import Preview from "./components/Preview";
import Toolbar from "./components/Toolbar";
import TabBar from "./components/TabBar";
import Explorer from "./components/Explorer";
import { useEditorActions } from "./hooks/useEditorActions";
import { useTabs } from "./hooks/useTabs";
import type { Mode } from "./types";

const TEXT_EXTENSIONS = new Set([
  "md", "txt", "json", "yaml", "yml", "toml", "csv",
  "ts", "tsx", "js", "jsx", "html", "css", "xml", "log",
  "ini", "conf", "sh", "bat",
]);

export default function App() {
  const tabs = useTabs();
  const tabsRef = useRef(tabs);
  tabsRef.current = tabs;

  const [mode, setMode] = useState<Mode>("edit");
  const [isDark, setIsDark] = useState(() =>
    window.matchMedia("(prefers-color-scheme: dark)").matches
  );
  const [isExplorerOpen, setIsExplorerOpen] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(() =>
    parseInt(localStorage.getItem("sidebarWidth") ?? "192")
  );
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

  // ウィンドウサイズの復元
  useEffect(() => {
    const savedW = parseInt(localStorage.getItem("windowWidth") ?? "0");
    const savedH = parseInt(localStorage.getItem("windowHeight") ?? "0");
    if (savedW > 0 && savedH > 0) {
      getCurrentWindow().setSize(new LogicalSize(savedW, savedH)).catch(console.error);
    }
  }, []);

  // ウィンドウサイズの保存
  useEffect(() => {
    const onResize = () => {
      getCurrentWindow().innerSize().then((size) => {
        localStorage.setItem("windowWidth", String(size.width));
        localStorage.setItem("windowHeight", String(size.height));
      }).catch(console.error);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

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

  const handleImagePaste = useCallback(async (blob: Blob, start: number, end: number) => {
    const filePath = tabsRef.current.activeFilePath;
    if (!filePath) return;

    const dir = filePath.replace(/[/\\][^/\\]*$/, "");
    const sep = filePath.includes("\\") ? "\\" : "/";
    const imageDir = dir + sep + "image";
    const ext = blob.type.split("/")[1]?.replace("jpeg", "jpg") ?? "png";
    const filename = `paste-${Date.now()}.${ext}`;
    const imagePath = imageDir + sep + filename;

    const bytes = new Uint8Array(await blob.arrayBuffer());
    await mkdir(imageDir, { recursive: true });
    await writeFile(imagePath, bytes);

    const insertText = `![${filename}](image/${filename})`;
    const current = tabsRef.current.activeContent;
    const newContent = current.slice(0, start) + insertText + current.slice(end);
    tabsRef.current.setActiveContentImmediate(newContent);

    requestAnimationFrame(() => {
      if (textareaRef.current) {
        const pos = start + insertText.length;
        textareaRef.current.setSelectionRange(pos, pos);
        textareaRef.current.focus();
      }
    });
  }, []);

  const handleOpenFileFromExplorer = useCallback(async (path: string) => {
    const existingId = tabsRef.current.findTabByPath(path);
    if (existingId) {
      tabsRef.current.switchTab(existingId);
      return;
    }

    const ext = path.split(".").pop()?.toLowerCase() ?? "";
    const fileName = path.split(/[\\/]/).pop() ?? path;
    const content = TEXT_EXTENSIONS.has(ext)
      ? await readTextFile(path)
      : `> このファイルは表示できません: \`${fileName}\``;

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
        {isExplorerOpen && (
          <>
            <Explorer onOpenFile={handleOpenFileFromExplorer} width={sidebarWidth} />
            <div
              className="w-1 shrink-0 cursor-col-resize bg-zinc-200 dark:bg-zinc-700 hover:bg-blue-400 active:bg-blue-500"
              onMouseDown={(e) => {
                const startX = e.clientX;
                const startW = sidebarWidth;
                const onMove = (ev: MouseEvent) => {
                  const w = Math.min(480, Math.max(160, startW + ev.clientX - startX));
                  setSidebarWidth(w);
                  localStorage.setItem("sidebarWidth", String(w));
                };
                const onUp = () => {
                  window.removeEventListener("mousemove", onMove);
                  window.removeEventListener("mouseup", onUp);
                };
                window.addEventListener("mousemove", onMove);
                window.addEventListener("mouseup", onUp);
              }}
            />
          </>
        )}
        <div className="flex flex-col flex-1 overflow-hidden">
          {mode === "edit" && (
            <>
              <Toolbar actions={editorActions} />
              <Editor
                ref={textareaRef}
                value={tabs.activeContent}
                onChange={tabs.setActiveContent}
                onProgrammaticChange={tabs.setActiveContentImmediate}
                onImagePaste={tabs.activeFilePath ? handleImagePaste : undefined}
              />
            </>
          )}
          {mode === "preview" && (
            <Preview
              markdown={tabs.activeContent}
              filePath={tabs.activeFilePath}
              isDark={isDark}
            />
          )}
        </div>
      </div>
    </div>
  );
}
