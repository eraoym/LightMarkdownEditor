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

/** 1タブ分の状態データ */
export interface TabData {
  /** タブの一意識別子 */
  id: string;
  /** 開いているファイルの絶対パス（新規未保存の場合は `null`） */
  filePath: string | null;
  /** エディタの現在内容 */
  content: string;
  /** 保存状態 */
  saveState: SaveState;
  /** アンドゥ/リドゥ用の履歴スタック */
  historyStack: string[];
  /** 履歴スタック内の現在位置 */
  historyCursor: number;
  /** デバウンス中の未コミット内容（タイマー発火前は `null` 以外） */
  historyPending: string | null;
  /** デバウンスタイマーのID（未スケジュール時は `null`） */
  historyTimer: ReturnType<typeof setTimeout> | null;
}
