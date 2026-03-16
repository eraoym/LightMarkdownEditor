import { useCallback, useEffect, useRef } from "react";
import { useState } from "react";
import { open, save } from "@tauri-apps/plugin-dialog";
import { readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import { getCurrentWindow } from "@tauri-apps/api/window";
import Header from "./components/Header";
import Editor from "./components/Editor";
import Preview from "./components/Preview";
import Toolbar from "./components/Toolbar";
import { useEditorActions } from "./hooks/useEditorActions";
import { useHistory } from "./hooks/useHistory";

type SaveState = "saved" | "unsaved" | "saving";
type Mode = "edit" | "preview";

export default function App() {
  const { value: markdown, set: setMarkdown, setImmediate: setProgrammatic, undo, redo, reset: resetHistory } = useHistory("");
  const [filePath, setFilePath] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [mode, setMode] = useState<Mode>("edit");
  const [isDark, setIsDark] = useState(() =>
    window.matchMedia("(prefers-color-scheme: dark)").matches
  );
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const editorActions = useEditorActions(textareaRef, markdown, setProgrammatic);
  // ref 経由でキーダウンハンドラから常に最新のアクションを呼び出す
  const editorActionsRef = useRef(editorActions);
  editorActionsRef.current = editorActions;

  useEffect(() => {
    const fileName = filePath?.split(/[\\/]/).pop() ?? null;
    const title = fileName ? `${fileName} - light-md` : "light-md";
    getCurrentWindow().setTitle(title).catch(console.error);
  }, [filePath]);

  const handleOpen = useCallback(async () => {
    const selected = await open({
      filters: [{ name: "Markdown", extensions: ["md", "txt"] }],
    });
    if (typeof selected !== "string") return;
    const content = await readTextFile(selected);
    resetHistory(content);
    setFilePath(selected);
    setSaveState("saved");
  }, [resetHistory]);

  const handleSave = useCallback(async () => {
    setSaveState("saving");
    let targetPath = filePath;

    if (!targetPath) {
      const chosen = await save({
        filters: [{ name: "Markdown", extensions: ["md"] }],
        defaultPath: "untitled.md",
      });
      if (!chosen) {
        setSaveState("unsaved");
        return;
      }
      targetPath = chosen;
    }

    await writeTextFile(targetPath, markdown);
    setFilePath(targetPath);
    setSaveState("saved");
  }, [filePath, markdown]);

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
        if (undo()) setSaveState("unsaved");
      } else if (e.key === "y") {
        e.preventDefault();
        if (redo()) setSaveState("unsaved");
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleSave, undo, redo]);

  const handleChange = (value: string) => {
    setMarkdown(value);
    setSaveState("unsaved");
  };

  const handleProgrammaticChange = (value: string) => {
    setProgrammatic(value);
    setSaveState("unsaved");
  };

  return (
    <div className={`flex flex-col h-screen bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 ${isDark ? "dark" : ""}`}>
      <Header
        filePath={filePath}
        saveState={saveState}
        onOpen={handleOpen}
        mode={mode}
        onModeChange={setMode}
        isDark={isDark}
        onThemeToggle={() => setIsDark((d) => !d)}
      />
      <div className="flex flex-col flex-1 overflow-hidden">
        {mode === "edit" && (
          <>
            <Toolbar actions={editorActions} />
            <Editor
              ref={textareaRef}
              value={markdown}
              onChange={handleChange}
              onProgrammaticChange={handleProgrammaticChange}
            />
          </>
        )}
        {mode === "preview" && <Preview markdown={markdown} />}
      </div>
    </div>
  );
}
