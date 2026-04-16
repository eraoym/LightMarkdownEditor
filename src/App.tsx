import { useCallback, useEffect, useRef, useState } from "react";
import { open, save, confirm } from "@tauri-apps/plugin-dialog";
import { readTextFile, writeTextFile, writeFile, mkdir, stat } from "@tauri-apps/plugin-fs";
import { getCurrentWindow, LogicalSize } from "@tauri-apps/api/window";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getVersion } from "@tauri-apps/api/app";
import Header from "./components/Header";
import Editor from "./components/Editor";
import Preview from "./components/Preview";
import Toolbar from "./components/Toolbar";
import TabBar from "./components/TabBar";
import Explorer from "./components/Explorer";
import TocSidebar from "./components/TocSidebar";
import SettingsModal from "./components/SettingsModal";
import PdfViewer from "./components/PdfViewer";
import { useEditorActions } from "./hooks/useEditorActions";
import { useTabs } from "./hooks/useTabs";
import type { Mode, AppSettings, FileType } from "./types";
import { DEFAULT_SETTINGS } from "./types";

/** テキストとして読み込める拡張子のセット。対象外はプレビュー不可メッセージを表示する */
const TEXT_EXTENSIONS = new Set([
  "md", "txt", "json", "yaml", "yml", "toml", "csv",
  "ts", "tsx", "js", "jsx", "html", "css", "xml", "log",
  "ini", "conf", "sh", "bat",
]);

/** PDF として表示できる拡張子のセット */
const PDF_EXTENSIONS = new Set(["pdf"]);

export default function App() {
  const tabs = useTabs();
  const tabsRef = useRef(tabs);
  tabsRef.current = tabs;

  const [mode, setMode] = useState<Mode>("edit");
  const [isDark, setIsDark] = useState(() =>
    window.matchMedia("(prefers-color-scheme: dark)").matches
  );
  const [settings, setSettings] = useState<AppSettings>(() => {
    try {
      const raw = localStorage.getItem("app_settings");
      return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS;
    } catch {
      return DEFAULT_SETTINGS;
    }
  });
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isExplorerOpen, setIsExplorerOpen] = useState(true);
  const [isDragOver, setIsDragOver] = useState(false);
  const [dropFolder, setDropFolder] = useState<string | undefined>(undefined);
  const [sidebarWidth, setSidebarWidth] = useState(() =>
    parseInt(localStorage.getItem("sidebarWidth") ?? "192")
  );
  const [isSplitPreview, setIsSplitPreview] = useState(false);
  const [splitWidth, setSplitWidth] = useState(() =>
    parseInt(localStorage.getItem("splitWidth") ?? "50")
  );
  const [isTocOpen, setIsTocOpen] = useState(false);
  const [tocWidth, setTocWidth] = useState(() =>
    parseInt(localStorage.getItem("tocWidth") ?? "220")
  );
  const [appVersion, setAppVersion] = useState("");
  // アプリバージョンを取得してヘッダーに表示する
  useEffect(() => {
    getVersion().then(setAppVersion).catch(() => {});
  }, []);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const previewScrollRef = useRef<HTMLDivElement | null>(null);
  const isSyncingScroll = useRef(false);

  const editorActions = useEditorActions(
    textareaRef,
    tabs.activeContent,
    tabs.setActiveContentImmediate,
    settings.headingNumberStart,
  );
  const editorActionsRef = useRef(editorActions);
  editorActionsRef.current = editorActions;

  // アクティブファイルのパスに応じてウィンドウタイトルを更新する
  useEffect(() => {
    const filePath = tabsRef.current.activeFilePath;
    const fileName = filePath?.split(/[\\/]/).pop() ?? null;
    const title = fileName ? `${fileName} - light-md` : "light-md";
    getCurrentWindow().setTitle(title).catch(console.error);
  }, [tabs.activeFilePath]);

  // 設定の localStorage 保存
  useEffect(() => {
    localStorage.setItem("app_settings", JSON.stringify(settings));
  }, [settings]);

  // 起動時にlocalStorageから前回のタブセッションを復元する
  // StrictMode の二重実行を防ぐため sessionRestoredRef でガードする
  const sessionRestoredRef = useRef(false);

  /** 現在開いているタブのファイルパス一覧とアクティブパスをlocalStorageに保存する */
  const saveSession = useCallback(() => {
    const toSave = tabsRef.current.tabs
      .filter((t) => t.filePath !== null)
      .map((t) => ({ filePath: t.filePath! }));
    localStorage.setItem("session_tabs", JSON.stringify(toSave));
    localStorage.setItem("session_activeFilePath", tabsRef.current.activeFilePath ?? "");
  }, []);

  useEffect(() => {
    if (sessionRestoredRef.current) return; // StrictMode 二重実行を防ぐ
    sessionRestoredRef.current = true;

    const raw = localStorage.getItem("session_tabs");
    const savedActive = localStorage.getItem("session_activeFilePath") ?? "";
    if (!raw) return;
    let savedTabs: { filePath: string }[];
    try { savedTabs = JSON.parse(raw); } catch { return; }
    if (!Array.isArray(savedTabs) || savedTabs.length === 0) return;

    (async () => {
      let targetId: string | undefined;
      const restoredPaths: string[] = [];

      for (const { filePath } of savedTabs) {
        try {
          const ext = filePath.split(".").pop()?.toLowerCase() ?? "";
          const fileName = filePath.split(/[\\/]/).pop() ?? filePath;
          const fileType: FileType = PDF_EXTENSIONS.has(ext) ? "pdf"
            : TEXT_EXTENSIONS.has(ext) ? "text"
            : "unsupported";
          const content = fileType === "text"
            ? await readTextFile(filePath)
            : fileType === "pdf"
            ? ""
            : `> このファイルは表示できません: \`${fileName}\``;
          restoredPaths.push(filePath);
          const newId = tabsRef.current.newTab();
          tabsRef.current.openFileInTab(filePath, content, newId, fileType);
          if (filePath === savedActive) targetId = newId;
        } catch {
          // ファイルが移動・削除されていればスキップ
        }
      }
      if (targetId) tabsRef.current.switchTab(targetId);
      tabsRef.current.pruneEmptyTabs(); // 起動時の初期空タブを除去
      localStorage.setItem("session_tabs", JSON.stringify(restoredPaths.map((fp) => ({ filePath: fp }))));
      localStorage.setItem("session_activeFilePath", restoredPaths.includes(savedActive) ? savedActive : (restoredPaths.at(-1) ?? ""));
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // セッション保存（タブ変化のたび・復元完了後のみ）
  useEffect(() => {
    if (!sessionRestoredRef.current) return;
    saveSession();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabs.tabs, tabs.activeFilePath]);

  // ウィンドウサイズの復元
  useEffect(() => {
    const savedW = parseInt(localStorage.getItem("windowWidth") ?? "0");
    const savedH = parseInt(localStorage.getItem("windowHeight") ?? "0");
    if (savedW > 0 && savedH > 0) {
      getCurrentWindow().setSize(new LogicalSize(savedW, savedH)).catch(console.error);
    }
  }, []);

  // ウィンドウサイズの保存（最大化中はスキップ）
  useEffect(() => {
    const onResize = () => {
      const win = getCurrentWindow();
      win.isMaximized().then((maximized) => {
        if (maximized) return;
        win.innerSize().then((size) => {
          localStorage.setItem("windowWidth", String(size.width));
          localStorage.setItem("windowHeight", String(size.height));
        }).catch(console.error);
      }).catch(console.error);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // スプリット時のスクロール同期
  useEffect(() => {
    if (!isSplitPreview) return;
    const editor = textareaRef.current;
    const preview = previewScrollRef.current;
    if (!editor || !preview) return;

    /** エディタのスクロール位置をプレビューに比率で同期する */
    const onEditorScroll = () => {
      if (isSyncingScroll.current) return;
      isSyncingScroll.current = true;
      const max = editor.scrollHeight - editor.clientHeight;
      if (max > 0)
        preview.scrollTop = (editor.scrollTop / max) * (preview.scrollHeight - preview.clientHeight);
      isSyncingScroll.current = false;
    };

    /** プレビューのスクロール位置をエディタに比率で同期する */
    const onPreviewScroll = () => {
      if (isSyncingScroll.current) return;
      isSyncingScroll.current = true;
      const max = preview.scrollHeight - preview.clientHeight;
      if (max > 0)
        editor.scrollTop = (preview.scrollTop / max) * (editor.scrollHeight - editor.clientHeight);
      isSyncingScroll.current = false;
    };

    editor.addEventListener("scroll", onEditorScroll);
    preview.addEventListener("scroll", onPreviewScroll);
    return () => {
      editor.removeEventListener("scroll", onEditorScroll);
      preview.removeEventListener("scroll", onPreviewScroll);
    };
  }, [isSplitPreview]);

  /**
   * ファイル選択ダイアログを開き、選択したファイルをタブで開く
   * 既に同パスのタブが開いている場合はそのタブへ切り替える
   */
  const handleOpen = useCallback(async () => {
    const explorerPath = localStorage.getItem("explorerPath");
    const selected = await open({
      filters: [
        { name: "Markdown / Text", extensions: ["md", "txt"] },
        { name: "PDF", extensions: ["pdf"] },
      ],
      defaultPath: explorerPath ?? undefined,
    });
    if (typeof selected !== "string") return;
    const existingId = tabsRef.current.findTabByPath(selected);
    if (existingId) {
      tabsRef.current.switchTab(existingId);
      return;
    }
    const ext = selected.split(".").pop()?.toLowerCase() ?? "";
    const fileType: FileType = PDF_EXTENSIONS.has(ext) ? "pdf" : "text";
    const content = fileType === "pdf" ? "" : await readTextFile(selected);
    const active = tabsRef.current.tabs.find(
      (t) => t.id === tabsRef.current.activeId
    )!;
    if (active.filePath === null && active.content === "") {
      tabsRef.current.openFileInTab(selected, content, active.id, fileType);
    } else {
      tabsRef.current.newTab();
      tabsRef.current.openFileInTab(selected, content, undefined, fileType);
    }
  }, []);

  /**
   * アクティブタブの内容をファイルに保存する
   * ファイルパスが未設定の場合は「名前を付けて保存」ダイアログを表示する
   */
  const handleSave = useCallback(async () => {
    if (tabsRef.current.activeFileType === "pdf") return;
    tabsRef.current.setActiveSaveState("saving");
    let targetPath = tabsRef.current.activeFilePath;

    if (!targetPath) {
      const explorerPath = localStorage.getItem("explorerPath");
      const chosen = await save({
        filters: [{ name: "Markdown", extensions: ["md"] }],
        defaultPath: explorerPath ? `${explorerPath}/untitled.md` : "untitled.md",
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

  /**
   * 未保存ファイルの確認ダイアログを表示した上で、指定タブ以外をすべて閉じる
   * @param id - 残すタブのID
   */
  const handleCloseOtherTabs = useCallback(async (id: string) => {
    const unsaved = tabsRef.current.tabs.filter(
      (t) => t.id !== id && t.saveState === "unsaved"
    );
    if (unsaved.length > 0) {
      const ok = await confirm(
        `未保存のファイルが ${unsaved.length} 件あります。閉じますか？`,
        { title: "確認", kind: "warning" }
      );
      if (!ok) return;
    }
    tabsRef.current.closeOtherTabs(id);
  }, []);

  /** 未保存ファイルの確認ダイアログを表示した上で、全タブを閉じる */
  const handleCloseAllTabs = useCallback(async () => {
    const unsaved = tabsRef.current.tabs.filter((t) => t.saveState === "unsaved");
    if (unsaved.length > 0) {
      const ok = await confirm(
        `未保存のファイルが ${unsaved.length} 件あります。すべて閉じますか？`,
        { title: "確認", kind: "warning" }
      );
      if (!ok) return;
    }
    tabsRef.current.closeAllTabs();
  }, []);

  /**
   * 未保存の場合は確認ダイアログを表示した上で、指定タブを閉じる
   * @param id - 閉じるタブのID
   */
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

  /**
   * プレビュー上のチェックボックスクリックに応じてMarkdownソースを書き換える
   * `- [ ]` と `- [x]` を相互にトグルする
   * @param line - チェックボックスがある行番号（1-indexed）
   */
  const handleCheckboxToggle = useCallback((line: number) => {
    const content = tabsRef.current.activeContent;
    const lines = content.split("\n");
    const idx = line - 1; // 1-indexed → 0-indexed
    if (idx < 0 || idx >= lines.length) return;
    if (lines[idx].includes("- [ ]")) {
      lines[idx] = lines[idx].replace("- [ ]", "- [x]");
    } else if (lines[idx].match(/- \[[xX]\]/)) {
      lines[idx] = lines[idx].replace(/- \[[xX]\]/, "- [ ]");
    } else {
      return;
    }
    tabsRef.current.setActiveContentImmediate(lines.join("\n"));
  }, []);

  /**
   * 貼り付けられた画像BlobをMarkdownファイルと同階層の `image/` ディレクトリに保存し、
   * カーソル位置にMarkdown画像リンクを挿入する
   * @param blob - 貼り付け画像のBlob
   * @param start - 挿入開始位置（セレクション先頭）
   * @param end - 挿入終了位置（セレクション末尾）
   */
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

  /**
   * エクスプローラー・ドラッグ&ドロップ・起動引数から指定パスのファイルを開く
   * 既に同パスのタブがある場合は切替のみ行う。await 後に再チェックして二重オープンを防止する
   * @param path - 開くファイルの絶対パス
   */
  const handleOpenFileFromExplorer = useCallback(async (path: string) => {
    const existingId = tabsRef.current.findTabByPath(path);
    if (existingId) {
      tabsRef.current.switchTab(existingId);
      return;
    }

    const ext = path.split(".").pop()?.toLowerCase() ?? "";
    const fileName = path.split(/[\\/]/).pop() ?? path;
    const fileType: FileType = PDF_EXTENSIONS.has(ext) ? "pdf"
      : TEXT_EXTENSIONS.has(ext) ? "text"
      : "unsupported";
    const content = fileType === "text"
      ? await readTextFile(path)
      : fileType === "pdf"
      ? ""
      : `> このファイルは表示できません: \`${fileName}\``;

    // await 後に再チェック（並走による二重オープン防止）
    const existingIdAfter = tabsRef.current.findTabByPath(path);
    if (existingIdAfter) {
      tabsRef.current.switchTab(existingIdAfter);
      return;
    }

    const active = tabsRef.current.tabs.find(
      (t) => t.id === tabsRef.current.activeId
    )!;
    if (active.filePath === null && active.content === "") {
      tabsRef.current.openFileInTab(path, content, active.id, fileType);
    } else {
      tabsRef.current.newTab();
      tabsRef.current.openFileInTab(path, content, undefined, fileType);
    }
  }, []);

  // ウィンドウへのドラッグ＆ドロップ
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    getCurrentWindow().onDragDropEvent(async (event) => {
      if (event.payload.type === "enter" || event.payload.type === "over") {
        setIsDragOver(true);
      } else if (event.payload.type === "leave") {
        setIsDragOver(false);
      } else if (event.payload.type === "drop") {
        setIsDragOver(false);
        for (const path of event.payload.paths) {
          try {
            const info = await stat(path);
            if (info.isDirectory) {
              setDropFolder(path);
              setIsExplorerOpen(true);
            } else {
              await handleOpenFileFromExplorer(path);
            }
          } catch {
            await handleOpenFileFromExplorer(path);
          }
        }
      }
    }).then((f) => { unlisten = f; });
    return () => { unlisten?.(); };
  }, [handleOpenFileFromExplorer]);

  // 起動時引数からファイルを開く（アイコンへのドロップ）
  useEffect(() => {
    invoke<string[]>("get_startup_args").then((filePaths) => {
      if (filePaths.length === 0) return;
      setTimeout(async () => {
        for (const path of filePaths) {
          await handleOpenFileFromExplorer(path);
        }
        tabsRef.current.pruneEmptyTabs();
      }, 300);
    }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // セカンドインスタンスからのファイル引数を受け取る（多重起動防止・Issue #21）
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    listen<string[]>("single-instance", async (event) => {
      const filePaths = event.payload;
      for (const path of filePaths) {
        await handleOpenFileFromExplorer(path);
      }
      tabsRef.current.pruneEmptyTabs();
    }).then((f) => { unlisten = f; });
    return () => { unlisten?.(); };
  }, [handleOpenFileFromExplorer]);

  // グローバルキーボードショートカットを登録する（Ctrl/Cmd + キー）
  useEffect(() => {
    /** 保存・書式・履歴・タブ切替・日時挿入などのショートカットを処理する */
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
      } else if (e.key === ";") {
        e.preventDefault();
        const d = new Date();
        editorActionsRef.current.insertAtCursor(
          `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`
        );
      } else if (e.key === ":") {
        e.preventDefault();
        const d = new Date();
        editorActionsRef.current.insertAtCursor(
          `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
        );
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleSave]);

  const isPdf = tabs.activeFileType === "pdf";

  return (
    <div
      className={`relative flex flex-col h-screen bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 ${isDark ? "dark" : ""}`}
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
        isSplitPreview={isSplitPreview}
        onSplitPreviewToggle={() => {
          if (!isSplitPreview) {
            const available = window.innerWidth - (isExplorerOpen ? sidebarWidth + 4 : 0);
            const half = Math.floor(available / 2);
            setSplitWidth(half);
            localStorage.setItem("splitWidth", String(half));
          }
          setIsSplitPreview((v) => !v);
        }}
        isTocOpen={isTocOpen}
        onTocToggle={() => setIsTocOpen((v) => !v)}
        onSettingsOpen={() => setIsSettingsOpen(true)}
        onPrint={() => window.print()}
        version={appVersion}
        isPdf={isPdf}
      />
      <TabBar
        tabs={tabs.tabs}
        activeId={tabs.activeId}
        onNew={tabs.newTab}
        onSwitch={tabs.switchTab}
        onClose={handleCloseTab}
        onCloseOthers={handleCloseOtherTabs}
        onCloseAll={handleCloseAllTabs}
        onReorder={tabs.reorderTabs}
      />
      <div className="flex flex-1 overflow-hidden">
        {isExplorerOpen && (
          <>
            <Explorer onOpenFile={handleOpenFileFromExplorer} width={sidebarWidth} initialFolder={dropFolder} />
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
          {mode === "edit" && !isPdf && <Toolbar actions={editorActions} />}
          <div className="flex flex-1 overflow-hidden">
            {/* PDF タブ: PdfViewer をフル表示 */}
            {isPdf && tabs.activeFilePath && (
              <PdfViewer filePath={tabs.activeFilePath} />
            )}
            {/* テキストタブ: 既存の Editor / Split / Preview */}
            {!isPdf && mode === "edit" && (
              <Editor
                ref={textareaRef}
                value={tabs.activeContent}
                onChange={tabs.setActiveContent}
                onProgrammaticChange={tabs.setActiveContentImmediate}
                onImagePaste={tabs.activeFilePath ? handleImagePaste : undefined}
                style={isSplitPreview ? { width: splitWidth, flexShrink: 0 } : undefined}
                fontSize={settings.editorFontSize}
                fontFamily={settings.editorFontFamily}
                tabWidth={settings.tabWidth}
              />
            )}
            {!isPdf && mode === "edit" && isSplitPreview && (
              <>
                <div
                  className="w-1 shrink-0 cursor-col-resize bg-zinc-200 dark:bg-zinc-700 hover:bg-blue-400 active:bg-blue-500"
                  onMouseDown={(e) => {
                    const startX = e.clientX;
                    const startW = splitWidth;
                    const onMove = (ev: MouseEvent) => {
                      const w = Math.min(window.innerWidth - 200, Math.max(200, startW + ev.clientX - startX));
                      setSplitWidth(w);
                      localStorage.setItem("splitWidth", String(w));
                    };
                    const onUp = () => {
                      window.removeEventListener("mousemove", onMove);
                      window.removeEventListener("mouseup", onUp);
                    };
                    window.addEventListener("mousemove", onMove);
                    window.addEventListener("mouseup", onUp);
                  }}
                />
                <div className="flex-1 overflow-hidden">
                  <Preview
                    markdown={tabs.activeContent}
                    filePath={tabs.activeFilePath}
                    isDark={isDark}
                    previewTheme={settings.previewTheme}
                    scrollRef={previewScrollRef}
                    onCheckboxToggle={handleCheckboxToggle}
                  />
                </div>
              </>
            )}
            {!isPdf && mode === "preview" && (
              <Preview
                markdown={tabs.activeContent}
                filePath={tabs.activeFilePath}
                isDark={isDark}
                previewTheme={settings.previewTheme}
                onCheckboxToggle={handleCheckboxToggle}
              />
            )}
            {!isPdf && mode === "preview" && isTocOpen && (
              <>
                <div
                  className="w-1 shrink-0 cursor-col-resize bg-zinc-200 dark:bg-zinc-700 hover:bg-blue-400 active:bg-blue-500"
                  onMouseDown={(e) => {
                    const startX = e.clientX;
                    const startW = tocWidth;
                    const onMove = (ev: MouseEvent) => {
                      const w = Math.min(480, Math.max(160, startW - (ev.clientX - startX)));
                      setTocWidth(w);
                      localStorage.setItem("tocWidth", String(w));
                    };
                    const onUp = () => {
                      window.removeEventListener("mousemove", onMove);
                      window.removeEventListener("mouseup", onUp);
                    };
                    window.addEventListener("mousemove", onMove);
                    window.addEventListener("mouseup", onUp);
                  }}
                />
                <TocSidebar markdown={tabs.activeContent} width={tocWidth} />
              </>
            )}
          </div>
        </div>
      </div>
      {isSettingsOpen && (
        <SettingsModal
          settings={settings}
          onChange={setSettings}
          onClose={() => setIsSettingsOpen(false)}
        />
      )}
      {isDragOver && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-blue-500/10 border-2 border-blue-500 border-dashed pointer-events-none">
          <span className="text-blue-600 dark:text-blue-400 text-lg font-semibold drop-shadow">ここにドロップして開く</span>
        </div>
      )}
    </div>
  );
}
