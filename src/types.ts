export type SaveState = "saved" | "unsaved" | "saving";
export type Mode = "edit" | "preview";

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
