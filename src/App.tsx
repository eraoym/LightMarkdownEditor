import { useCallback, useEffect, useState } from "react";
import { open, save } from "@tauri-apps/plugin-dialog";
import { readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import { getCurrentWindow } from "@tauri-apps/api/window";
import Header from "./components/Header";
import Editor from "./components/Editor";
import Preview from "./components/Preview";

type SaveState = "saved" | "unsaved" | "saving";
type Mode = "edit" | "preview";

export default function App() {
  const [markdown, setMarkdown] = useState<string>("");
  const [filePath, setFilePath] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [mode, setMode] = useState<Mode>("edit");

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
    setMarkdown(content);
    setFilePath(selected);
    setSaveState("saved");
  }, []);

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
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleSave]);

  const handleChange = (value: string) => {
    setMarkdown(value);
    setSaveState("unsaved");
  };

  return (
    <div className="flex flex-col h-screen bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100">
      <Header filePath={filePath} saveState={saveState} onOpen={handleOpen} mode={mode} onModeChange={setMode} />
      <div className="flex flex-1 overflow-hidden">
        {mode === "edit" && <Editor value={markdown} onChange={handleChange} />}
        {mode === "preview" && <Preview markdown={markdown} />}
      </div>
    </div>
  );
}
