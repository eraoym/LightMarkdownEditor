import type { AppSettings, PreviewTheme } from "../types";

interface SettingsModalProps {
  settings: AppSettings;
  onChange: (s: AppSettings) => void;
  onClose: () => void;
}

const FONT_OPTIONS = [
  { label: "ui-monospace", value: "ui-monospace, monospace" },
  { label: "Consolas", value: "Consolas, monospace" },
  { label: "Courier New", value: "'Courier New', monospace" },
];

const PREVIEW_THEME_OPTIONS: { label: string; value: PreviewTheme }[] = [
  { label: "GitHub", value: "github" },
  { label: "Minimal", value: "minimal" },
  { label: "Academic", value: "academic" },
];

export default function SettingsModal({ settings, onChange, onClose }: SettingsModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-xl w-80 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold">設定</h2>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 text-lg leading-none"
          >
            ✕
          </button>
        </div>

        {/* フォントサイズ */}
        <div className="mb-4">
          <label className="block text-sm mb-1">
            エディタフォントサイズ: <span className="font-mono">{settings.editorFontSize}px</span>
          </label>
          <input
            type="range"
            min={12}
            max={20}
            step={2}
            value={settings.editorFontSize}
            onChange={(e) =>
              onChange({ ...settings, editorFontSize: Number(e.target.value) })
            }
            className="w-full accent-blue-500"
          />
          <div className="flex justify-between text-xs text-zinc-400 mt-0.5">
            <span>12px</span><span>20px</span>
          </div>
        </div>

        {/* フォントファミリー */}
        <div className="mb-4">
          <label className="block text-sm mb-1">エディタフォント</label>
          <select
            value={settings.editorFontFamily}
            onChange={(e) =>
              onChange({ ...settings, editorFontFamily: e.target.value })
            }
            className="w-full text-sm border border-zinc-300 dark:border-zinc-600 rounded px-2 py-1 bg-white dark:bg-zinc-700"
          >
            {FONT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* タブ幅 */}
        <div className="mb-4">
          <label className="block text-sm mb-1">タブ幅</label>
          <div className="flex gap-2">
            {([2, 4] as const).map((w) => (
              <button
                key={w}
                onClick={() => onChange({ ...settings, tabWidth: w })}
                className={`flex-1 text-sm py-1 rounded border ${
                  settings.tabWidth === w
                    ? "bg-blue-500 text-white border-blue-500"
                    : "border-zinc-300 dark:border-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-700"
                }`}
              >
                {w} スペース
              </button>
            ))}
          </div>
        </div>

        {/* プレビューテーマ */}
        <div className="mb-4">
          <label className="block text-sm mb-1">プレビューテーマ</label>
          <div className="flex gap-2">
            {PREVIEW_THEME_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => onChange({ ...settings, previewTheme: opt.value })}
                className={`flex-1 text-sm py-1 rounded border ${
                  settings.previewTheme === opt.value
                    ? "bg-blue-500 text-white border-blue-500"
                    : "border-zinc-300 dark:border-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-700"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* 見出し番号付与開始レベル */}
        <div className="mb-2">
          <label className="block text-sm mb-1">見出し番号付与の開始レベル</label>
          <div className="flex gap-2">
            {([1, 2] as const).map((level) => (
              <button
                key={level}
                onClick={() => onChange({ ...settings, headingNumberStart: level })}
                className={`flex-1 text-sm py-1 rounded border ${
                  settings.headingNumberStart === level
                    ? "bg-blue-500 text-white border-blue-500"
                    : "border-zinc-300 dark:border-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-700"
                }`}
              >
                H{level} から
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
