import { useEffect, useRef, useState } from "react";
import type { TabData } from "../types";

interface ContextMenuState {
  tabId: string;
  x: number;
  y: number;
}

interface TabBarProps {
  tabs: Readonly<TabData>[];
  activeId: string;
  onNew: () => void;
  onSwitch: (id: string) => void;
  onClose: (id: string) => void;
  onCloseOthers: (id: string) => void;
  onCloseAll: () => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
}

export default function TabBar({
  tabs,
  activeId,
  onNew,
  onSwitch,
  onClose,
  onCloseOthers,
  onCloseAll,
  onReorder,
}: TabBarProps) {
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const dragStateRef = useRef<{ fromIndex: number; overIndex: number } | null>(null);
  const dragMovedRef = useRef(false);
  const tabListRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!contextMenu) return;
    const handler = () => setContextMenu(null);
    document.addEventListener("click", handler);
    document.addEventListener("contextmenu", handler);
    return () => {
      document.removeEventListener("click", handler);
      document.removeEventListener("contextmenu", handler);
    };
  }, [contextMenu]);

  const handleTabMouseDown = (e: React.MouseEvent, index: number) => {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest("button")) return;

    dragStateRef.current = { fromIndex: index, overIndex: index };
    dragMovedRef.current = false;

    const handleMouseMove = (ev: MouseEvent) => {
      if (!dragStateRef.current || !tabListRef.current) return;
      const children = Array.from(tabListRef.current.children) as HTMLElement[];
      for (let i = 0; i < children.length; i++) {
        const rect = children[i].getBoundingClientRect();
        if (ev.clientX >= rect.left && ev.clientX <= rect.right) {
          dragStateRef.current.overIndex = i;
          setDragOverIndex(i);
          if (i !== dragStateRef.current.fromIndex) dragMovedRef.current = true;
          return;
        }
      }
    };

    const handleMouseUp = () => {
      if (dragStateRef.current) {
        const { fromIndex, overIndex } = dragStateRef.current;
        if (overIndex !== fromIndex) onReorder(fromIndex, overIndex);
      }
      dragStateRef.current = null;
      setDragOverIndex(null);
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

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
      <div ref={tabListRef} className="flex overflow-hidden">
        {tabs.map((tab, index) => {
          const isActive = tab.id === activeId;
          const isDragOver = dragOverIndex === index;
          const label = tab.filePath
            ? (tab.filePath.split(/[\\/]/).pop() ?? tab.filePath)
            : "新規ファイル";
          return (
            <div
              key={tab.id}
              onMouseDown={(e) => handleTabMouseDown(e, index)}
              className={`max-w-[160px] shrink-0 flex items-center gap-1 px-3 h-8 text-sm border-r border-zinc-200 dark:border-zinc-700 cursor-pointer select-none ${
                isDragOver
                  ? "bg-blue-100 dark:bg-blue-900/40"
                  : isActive
                  ? "bg-white dark:bg-zinc-900"
                  : "bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-750"
              }`}
              onClick={() => {
                if (dragMovedRef.current) { dragMovedRef.current = false; return; }
                onSwitch(tab.id);
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setContextMenu({ tabId: tab.id, x: e.clientX, y: e.clientY });
              }}
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

      {contextMenu && (
        <div
          className="fixed z-50 min-w-[160px] bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-600 rounded shadow-lg py-1 text-sm"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className="w-full text-left px-4 py-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-700"
            onClick={() => { onClose(contextMenu.tabId); setContextMenu(null); }}
          >
            タブを閉じる
          </button>
          <button
            className="w-full text-left px-4 py-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-700"
            onClick={() => { onCloseOthers(contextMenu.tabId); setContextMenu(null); }}
          >
            他のタブをすべて閉じる
          </button>
          <div className="border-t border-zinc-200 dark:border-zinc-600 my-1" />
          <button
            className="w-full text-left px-4 py-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-700"
            onClick={() => { onCloseAll(); setContextMenu(null); }}
          >
            すべてのタブを閉じる
          </button>
        </div>
      )}
    </div>
  );
}
