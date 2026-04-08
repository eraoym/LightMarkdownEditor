export type SaveState = "saved" | "unsaved" | "saving";
export type Mode = "edit" | "preview";
export type PreviewTheme = "github" | "minimal" | "academic";

export interface AppSettings {
  editorFontSize: number;
  editorFontFamily: string;
  tabWidth: 2 | 4;
  previewTheme: PreviewTheme;
  headingNumberStart: 1 | 2;
}

export const DEFAULT_SETTINGS: AppSettings = {
  editorFontSize: 14,
  editorFontFamily: "ui-monospace, monospace",
  tabWidth: 2,
  previewTheme: "github",
  headingNumberStart: 1,
};

export interface TabData {
  id: string;
  filePath: string | null;
  content: string;
  saveState: SaveState;
  historyStack: string[];
  historyCursor: number;
  historyPending: string | null;
  historyTimer: ReturnType<typeof setTimeout> | null;
}
