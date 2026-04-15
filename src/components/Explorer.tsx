import { useRef } from "react";
import {
  TreeNode,
  InlineInputState,
  useExplorer,
} from "../hooks/useExplorer";

// ---------------------------------------------------------------------------
// インライン入力コンポーネント
// ---------------------------------------------------------------------------

interface InlineInputRowProps {
  depth: number;
  state: InlineInputState;
  onChange: (value: string) => void;
  onCommit: () => void;
  onCancel: () => void;
}

function InlineInputRow({ depth, state, onChange, onCommit, onCancel }: InlineInputRowProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const committedRef = useRef(false);

  // マウント時にフォーカス
  const setFocus = (el: HTMLInputElement | null) => {
    inputRef.current = el;
    el?.focus();
  };

  const commit = () => {
    if (committedRef.current) return;
    committedRef.current = true;
    onCommit();
  };

  return (
    <div
      className="flex items-center gap-1 py-0.5"
      style={{ paddingLeft: depth * 12 + 8 }}
    >
      <span className="shrink-0 text-xs">
        {state.type === "directory" ? "▶" : "　"}
      </span>
      <input
        ref={setFocus}
        className="flex-1 text-sm bg-transparent border-b border-blue-500 focus:outline-none dark:text-zinc-100"
        value={state.value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") { e.preventDefault(); commit(); }
          if (e.key === "Escape") { e.preventDefault(); onCancel(); }
        }}
        onBlur={commit}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Explorer コンポーネント
// ---------------------------------------------------------------------------

interface ExplorerProps {
  onOpenFile: (path: string) => void;
  width: number;
  initialFolder?: string;
}

/**
 * ファイルエクスプローラーコンポーネント
 * フォルダツリーを表示し、右クリックメニュー・D&D・リアルタイム更新に対応する
 */
export default function Explorer({ onOpenFile, width, initialFolder }: ExplorerProps) {
  const {
    rootPath,
    tree,
    contextMenu,
    inlineInput,
    dragState,
    dropTargetPath,
    handleSelectFolder,
    handleToggleNode,
    handleContextMenu,
    handleContextMenuAction,
    handleInlineChange,
    handleInlineCommit,
    handleInlineCancel,
    handleNodeMouseDown,
  } = useExplorer(onOpenFile, initialFolder);

  // ---------------------------------------------------------------------------
  // ツリーレンダリング
  // ---------------------------------------------------------------------------

  const renderNodes = (nodes: TreeNode[], depth: number): React.ReactNode => {
    const items: React.ReactNode[] = [];

    // ルート直下へのインライン入力（背景右クリックまたはルートフォルダ操作時）
    if (depth === 0 && inlineInput && inlineInput.parentPath === rootPath) {
      items.push(
        <InlineInputRow
          key="__inline_root__"
          depth={0}
          state={inlineInput}
          onChange={handleInlineChange}
          onCommit={handleInlineCommit}
          onCancel={handleInlineCancel}
        />
      );
    }

    for (const node of nodes) {
      const isDropTarget = dropTargetPath === node.path;
      const isDragging = dragState?.sourcePath === node.path;

      items.push(
        <div key={node.path}>
          <button
            data-node-path={node.path}
            data-is-dir={node.isDirectory.toString()}
            className={[
              "w-full text-left flex items-center gap-1 py-0.5 text-sm rounded truncate",
              "hover:bg-zinc-100 dark:hover:bg-zinc-800",
              isDropTarget ? "bg-blue-100 dark:bg-blue-900/40 ring-1 ring-blue-400" : "",
              isDragging ? "opacity-50" : "",
            ].join(" ")}
            style={{ paddingLeft: depth * 12 + 8 }}
            title={node.path}
            onClick={() => handleToggleNode(node)}
            onContextMenu={(e) => handleContextMenu(e, node)}
            onMouseDown={(e) => handleNodeMouseDown(e, node)}
          >
            <span className="shrink-0 text-xs" data-node-path={node.path} data-is-dir={node.isDirectory.toString()}>
              {node.isDirectory ? (node.isExpanded ? "▼" : "▶") : "　"}
            </span>
            <span className="truncate" data-node-path={node.path} data-is-dir={node.isDirectory.toString()}>{node.name}</span>
          </button>

          {/* フォルダ展開中: 子ノードの先頭にインライン入力をインジェクト */}
          {node.isDirectory && node.isExpanded && (
            <div>
              {inlineInput && inlineInput.parentPath === node.path && (
                <InlineInputRow
                  key="__inline__"
                  depth={depth + 1}
                  state={inlineInput}
                  onChange={handleInlineChange}
                  onCommit={handleInlineCommit}
                  onCancel={handleInlineCancel}
                />
              )}
              {node.children && renderNodes(node.children, depth + 1)}
            </div>
          )}
        </div>
      );
    }

    return items;
  };

  // ---------------------------------------------------------------------------
  // コンテキストメニュー
  // ---------------------------------------------------------------------------

  const renderContextMenu = () => {
    if (!contextMenu) return null;

    const isBackground = contextMenu.kind === "background";
    const isDirectory = contextMenu.kind === "directory";

    return (
      <div
        className="fixed z-50 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-600 rounded shadow-lg py-1 text-sm min-w-36"
        style={{ left: contextMenu.x, top: contextMenu.y }}
        onClick={(e) => e.stopPropagation()}
      >
        {(isBackground || isDirectory) && (
          <>
            <button
              className="w-full text-left px-3 py-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-700"
              onClick={() => handleContextMenuAction("new-file")}
            >
              新しいファイル
            </button>
            <button
              className="w-full text-left px-3 py-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-700"
              onClick={() => handleContextMenuAction("new-folder")}
            >
              新しいフォルダ
            </button>
          </>
        )}
        {!isBackground && (
          <>
            {isDirectory && (
              <div className="border-t border-zinc-200 dark:border-zinc-600 my-1" />
            )}
            <button
              className="w-full text-left px-3 py-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-red-600 dark:text-red-400"
              onClick={() => handleContextMenuAction("delete")}
            >
              削除
            </button>
          </>
        )}
      </div>
    );
  };

  // ---------------------------------------------------------------------------
  // レンダリング
  // ---------------------------------------------------------------------------

  return (
    <div
      className="shrink-0 flex flex-col border-r border-zinc-200 dark:border-zinc-700 overflow-hidden"
      style={{ width }}
      onContextMenu={(e) => handleContextMenu(e)}
    >
      {/* フォルダ選択ボタン（ルートへのドロップターゲットも兼ねる） */}
      <div className="px-2 py-1 border-b border-zinc-200 dark:border-zinc-700 shrink-0">
        <button
          data-node-path={rootPath ?? ""}
          data-is-dir="true"
          onClick={handleSelectFolder}
          className={[
            "w-full text-xs px-2 py-1 rounded border truncate",
            dropTargetPath === rootPath && rootPath
              ? "border-blue-400 bg-blue-100 dark:bg-blue-900/40"
              : "border-zinc-300 dark:border-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800",
          ].join(" ")}
          title={rootPath ?? "フォルダを選択"}
        >
          {rootPath ? rootPath.split(/[\\/]/).pop() : "フォルダを選択"}
        </button>
      </div>

      {/* ツリー */}
      <div className="flex-1 overflow-y-auto px-1 py-1">
        {tree.length === 0 && !inlineInput && (
          <p className="text-xs text-zinc-400 px-2 py-2">
            {rootPath ? "空のフォルダ" : "フォルダを選択してください"}
          </p>
        )}
        {renderNodes(tree, 0)}
      </div>

      {/* コンテキストメニュー */}
      {renderContextMenu()}
    </div>
  );
}
