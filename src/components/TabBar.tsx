import type { TabData } from "../types";

interface TabBarProps {
  tabs: Readonly<TabData>[];
  activeId: string;
  onNew: () => void;
  onSwitch: (id: string) => void;
  onClose: (id: string) => void;
}

export default function TabBar({
  tabs,
  activeId,
  onNew,
  onSwitch,
  onClose,
}: TabBarProps) {
  return (
    <div className="flex items-center border-b border-zinc-200 dark:border-zinc-700 shrink-0 overflow-hidden">
      <button
        onMouseDown={(e) => e.preventDefault()}
        onClick={onNew}
        className="shrink-0 px-3 h-8 text-sm border-r border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800"
        title="新しいタブ"
      >
        +
      </button>
      <div className="flex overflow-hidden">
        {tabs.map((tab) => {
          const isActive = tab.id === activeId;
          const label = tab.filePath
            ? (tab.filePath.split(/[\\/]/).pop() ?? tab.filePath)
            : "新規ファイル";
          return (
            <div
              key={tab.id}
              className={`max-w-[160px] shrink-0 flex items-center gap-1 px-3 h-8 text-sm border-r border-zinc-200 dark:border-zinc-700 cursor-pointer ${
                isActive
                  ? "bg-white dark:bg-zinc-900"
                  : "bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-750"
              }`}
              onClick={() => onSwitch(tab.id)}
            >
              <span className="truncate flex-1 text-xs">{label}</span>
              {tab.saveState === "unsaved" && (
                <span className="text-xs text-zinc-400 shrink-0">●</span>
              )}
              <button
                onMouseDown={(e) => e.preventDefault()}
                onClick={(e) => {
                  e.stopPropagation();
                  onClose(tab.id);
                }}
                className="shrink-0 w-4 h-4 flex items-center justify-center text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 rounded hover:bg-zinc-200 dark:hover:bg-zinc-600 text-xs"
                title="閉じる"
              >
                ×
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
