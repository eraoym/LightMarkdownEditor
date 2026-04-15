import { useEffect, useRef, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { confirm } from "@tauri-apps/plugin-dialog";
import { mkdir, readDir, remove, rename, writeTextFile } from "@tauri-apps/plugin-fs";

// ---------------------------------------------------------------------------
// 型定義
// ---------------------------------------------------------------------------

export interface TreeNode {
  name: string;
  path: string;
  isDirectory: boolean;
  isExpanded: boolean;
  children: TreeNode[] | null;
}

export type ContextMenuTarget =
  | { kind: "file"; node: TreeNode; x: number; y: number }
  | { kind: "directory"; node: TreeNode; x: number; y: number }
  | { kind: "background"; x: number; y: number };

export interface InlineInputState {
  parentPath: string;
  type: "file" | "directory";
  value: string;
}

export interface DragState {
  sourcePath: string;
  sourceIsDirectory: boolean;
}

// ---------------------------------------------------------------------------
// ヘルパー関数（フック外）
// ---------------------------------------------------------------------------

/** 指定ディレクトリの直下エントリを読み込みツリーノード配列として返す（ディレクトリ優先ソート） */
export async function loadChildren(dirPath: string): Promise<TreeNode[]> {
  const entries = await readDir(dirPath);
  const sep = dirPath.includes("\\") ? "\\" : "/";
  const base = dirPath.replace(/[/\\]+$/, "");
  const nodes: TreeNode[] = entries
    .filter((e) => e.name != null)
    .map((e) => ({
      name: e.name!,
      path: base + sep + e.name!,
      isDirectory: e.isDirectory ?? false,
      isExpanded: false,
      children: e.isDirectory ? null : [],
    }));
  nodes.sort((a, b) => {
    if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  return nodes;
}

/** ツリーノード配列を再帰的に走査し、対象パスの展開状態と子ノードを更新する */
function updateNodeExpanded(
  nodes: TreeNode[],
  targetPath: string,
  newChildren: TreeNode[],
  isExpanded: boolean
): TreeNode[] {
  return nodes.map((n) => {
    if (n.path === targetPath) {
      return { ...n, isExpanded, children: newChildren };
    }
    if (n.children && n.children.length > 0) {
      return {
        ...n,
        children: updateNodeExpanded(n.children, targetPath, newChildren, isExpanded),
      };
    }
    return n;
  });
}

/** 展開中のパスを再帰的に収集する */
function collectExpandedPaths(nodes: TreeNode[]): Set<string> {
  const result = new Set<string>();
  for (const n of nodes) {
    if (n.isDirectory && n.isExpanded) {
      result.add(n.path);
      if (n.children) {
        for (const p of collectExpandedPaths(n.children)) result.add(p);
      }
    }
  }
  return result;
}

/** 展開状態を保ちながらディレクトリを再読み込みする */
async function restoreExpanded(
  nodes: TreeNode[],
  expandedPaths: Set<string>
): Promise<TreeNode[]> {
  return Promise.all(
    nodes.map(async (n) => {
      if (n.isDirectory && expandedPaths.has(n.path)) {
        try {
          const children = await loadChildren(n.path);
          const restored = await restoreExpanded(children, expandedPaths);
          return { ...n, isExpanded: true, children: restored };
        } catch {
          return { ...n, isExpanded: false, children: null };
        }
      }
      return n;
    })
  );
}

/** 既存ツリーの展開状態を引き継ぎながらルートを再読み込みする */
async function refreshTree(rootPath: string, currentTree: TreeNode[]): Promise<TreeNode[]> {
  const expandedPaths = collectExpandedPaths(currentTree);
  const fresh = await loadChildren(rootPath);
  return restoreExpanded(fresh, expandedPaths);
}

// ---------------------------------------------------------------------------
// useExplorer カスタムフック
// ---------------------------------------------------------------------------

export function useExplorer(
  onOpenFile: (path: string) => void,
  initialFolder?: string
) {
  const [rootPath, setRootPath] = useState<string | null>(null);
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [contextMenu, setContextMenu] = useState<ContextMenuTarget | null>(null);
  const [inlineInput, setInlineInput] = useState<InlineInputState | null>(null);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [dropTargetPath, setDropTargetPath] = useState<string | null>(null);

  // stale closure 対策: tree / rootPath / dragState の最新値を ref でも保持する
  const treeRef = useRef<TreeNode[]>([]);
  const rootPathRef = useRef<string | null>(null);
  const dragStateRef = useRef<DragState | null>(null);

  const updateTree = (nodes: TreeNode[]) => {
    treeRef.current = nodes;
    setTree(nodes);
  };

  const updateRootPath = (path: string | null) => {
    rootPathRef.current = path;
    setRootPath(path);
  };

  const updateDragState = (state: DragState | null) => {
    dragStateRef.current = state;
    setDragState(state);
  };

  // ---------------------------------------------------------------------------
  // 初期化: localStorage からパスを復元
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const saved = localStorage.getItem("explorerPath");
    if (!saved) return;
    updateRootPath(saved);
    loadChildren(saved).then(updateTree).catch(() => {});
  }, []);

  // ---------------------------------------------------------------------------
  // 初期フォルダ（ウィンドウへのD&D）が変わったとき
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!initialFolder) return;
    updateRootPath(initialFolder);
    localStorage.setItem("explorerPath", initialFolder);
    loadChildren(initialFolder).then(updateTree).catch(() => {});
  }, [initialFolder]);

  // ---------------------------------------------------------------------------
  // ポーリング（2秒ごとにルートを再読み込み）
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!rootPath) return;
    const id = setInterval(async () => {
      if (!rootPathRef.current) return;
      try {
        const fresh = await refreshTree(rootPathRef.current, treeRef.current);
        updateTree(fresh);
      } catch {
        // フォルダが削除された等は無視
      }
    }, 2000);
    return () => clearInterval(id);
  }, [rootPath]);

  // ---------------------------------------------------------------------------
  // コンテキストメニューを外クリックで閉じる
  // ---------------------------------------------------------------------------
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

  // ---------------------------------------------------------------------------
  // ハンドラ
  // ---------------------------------------------------------------------------

  /** フォルダ選択ダイアログを開く */
  const handleSelectFolder = async () => {
    const selected = await open({ directory: true, defaultPath: rootPath ?? undefined });
    if (typeof selected !== "string") return;
    updateRootPath(selected);
    localStorage.setItem("explorerPath", selected);
    const children = await loadChildren(selected);
    updateTree(children);
  };

  /** ノードクリック: フォルダなら展開/折り畳み、ファイルなら開く */
  const handleToggleNode = async (node: TreeNode) => {
    if (!node.isDirectory) {
      onOpenFile(node.path);
      return;
    }
    if (node.isExpanded) {
      const newTree = updateNodeExpanded(treeRef.current, node.path, node.children ?? [], false);
      updateTree(newTree);
      return;
    }
    try {
      const children = node.children === null ? await loadChildren(node.path) : node.children;
      const newTree = updateNodeExpanded(treeRef.current, node.path, children, true);
      updateTree(newTree);
    } catch (e) {
      console.error("フォルダ展開エラー:", node.path, e);
    }
  };

  /** 右クリックメニューを開く */
  const handleContextMenu = (
    e: React.MouseEvent,
    node?: TreeNode
  ) => {
    e.preventDefault();
    e.stopPropagation();
    if (!node) {
      setContextMenu({ kind: "background", x: e.clientX, y: e.clientY });
    } else if (node.isDirectory) {
      setContextMenu({ kind: "directory", node, x: e.clientX, y: e.clientY });
    } else {
      setContextMenu({ kind: "file", node, x: e.clientX, y: e.clientY });
    }
  };

  /** コンテキストメニューのアクション処理 */
  const handleContextMenuAction = async (
    action: "new-file" | "new-folder" | "delete"
  ) => {
    if (!contextMenu) return;
    setContextMenu(null);

    if (action === "new-file" || action === "new-folder") {
      let parentPath: string;
      if (contextMenu.kind === "background") {
        if (!rootPathRef.current) return;
        parentPath = rootPathRef.current;
        // ルートに作成する場合、ルートノードが展開済みでなければ何もしない（パス判定のみ）
      } else {
        // directory または file の場合
        const node = (contextMenu as { node: TreeNode }).node;
        parentPath = node.isDirectory ? node.path : (() => {
          const sep = node.path.includes("\\") ? "\\" : "/";
          return node.path.split(sep).slice(0, -1).join(sep);
        })();
      }
      setInlineInput({
        parentPath,
        type: action === "new-file" ? "file" : "directory",
        value: "",
      });
    } else if (action === "delete") {
      if (contextMenu.kind === "background") return;
      const node = (contextMenu as { node: TreeNode }).node;
      const msg = node.isDirectory
        ? `「${node.name}」を削除しますか？\nフォルダ内のすべてのファイルも削除されます。`
        : `「${node.name}」を削除しますか？`;
      const confirmed = await confirm(msg, { title: "削除の確認", kind: "warning" });
      if (!confirmed) return;
      try {
        await remove(node.path, { recursive: node.isDirectory });
        if (rootPathRef.current) {
          const fresh = await refreshTree(rootPathRef.current, treeRef.current);
          updateTree(fresh);
        }
      } catch (e) {
        console.error("削除エラー:", e);
      }
    }
  };

  /** インライン入力の値を更新する */
  const handleInlineChange = (value: string) => {
    setInlineInput((prev) => (prev ? { ...prev, value } : null));
  };

  /** インライン入力をコミットしてファイル/フォルダを作成する */
  const handleInlineCommit = async () => {
    if (!inlineInput || !inlineInput.value.trim()) {
      setInlineInput(null);
      return;
    }
    const sep = inlineInput.parentPath.includes("\\") ? "\\" : "/";
    const newPath = inlineInput.parentPath + sep + inlineInput.value.trim();
    try {
      if (inlineInput.type === "directory") {
        await mkdir(newPath);
      } else {
        await writeTextFile(newPath, "");
      }
      setInlineInput(null);
      if (rootPathRef.current) {
        // 作成先フォルダが展開されていない場合は展開状態を追加してから更新
        const expandedPaths = collectExpandedPaths(treeRef.current);
        expandedPaths.add(inlineInput.parentPath);
        const fresh = await loadChildren(rootPathRef.current);
        const restored = await restoreExpanded(fresh, expandedPaths);
        updateTree(restored);
      }
    } catch (e) {
      console.error("作成エラー:", e);
      setInlineInput(null);
    }
  };

  /** インライン入力をキャンセルする */
  const handleInlineCancel = () => {
    setInlineInput(null);
  };

  // ---------------------------------------------------------------------------
  // ドラッグ&ドロップ（mousedown/mousemove/mouseup 方式）
  // Tauri v2 の onDragDropEvent が WebView2 の OS レベル D&D をフックするため
  // HTML5 D&D API が動作しない。TabBar.tsx と同じマウスイベント方式で実装する。
  // ---------------------------------------------------------------------------

  const handleNodeMouseDown = (e: React.MouseEvent, node: TreeNode) => {
    if (e.button !== 0) return;

    dragStateRef.current = { sourcePath: node.path, sourceIsDirectory: node.isDirectory };
    setDragState({ sourcePath: node.path, sourceIsDirectory: node.isDirectory });

    // ドラッグ中のテキスト選択を抑止
    const savedUserSelect = document.body.style.userSelect;
    document.body.style.userSelect = "none";

    const handleMouseMove = (ev: MouseEvent) => {
      const src = dragStateRef.current;
      if (!src) return;

      const el = document.elementFromPoint(ev.clientX, ev.clientY);
      const nodeEl = el?.closest("[data-node-path]") as HTMLElement | null;
      const targetPath = nodeEl?.getAttribute("data-node-path");
      const targetIsDir = nodeEl?.getAttribute("data-is-dir") === "true";

      if (targetPath && targetIsDir && targetPath !== src.sourcePath) {
        const sep = src.sourcePath.includes("\\") ? "\\" : "/";
        if (!targetPath.startsWith(src.sourcePath + sep)) {
          setDropTargetPath(targetPath);
          return;
        }
      }
      setDropTargetPath(null);
    };

    const handleMouseUp = async (ev: MouseEvent) => {
      document.body.style.userSelect = savedUserSelect;
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);

      const src = dragStateRef.current;
      dragStateRef.current = null;
      updateDragState(null);
      setDropTargetPath(null);

      if (!src) return;

      // マウスアップ地点のドロップターゲットを取得
      const el = document.elementFromPoint(ev.clientX, ev.clientY);
      const nodeEl = el?.closest("[data-node-path]") as HTMLElement | null;
      const targetPath = nodeEl?.getAttribute("data-node-path");
      const targetIsDir = nodeEl?.getAttribute("data-is-dir") === "true";

      if (!targetPath || !targetIsDir || targetPath === src.sourcePath) return;

      const sep = src.sourcePath.includes("\\") ? "\\" : "/";
      if (targetPath.startsWith(src.sourcePath + sep)) return;

      const srcName = src.sourcePath.split(/[\\/]/).pop()!;
      const destPath = targetPath + sep + srcName;

      try {
        await rename(src.sourcePath, destPath);
        if (rootPathRef.current) {
          const fresh = await refreshTree(rootPathRef.current, treeRef.current);
          updateTree(fresh);
        }
      } catch (err) {
        console.error("移動エラー:", err);
      }
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  return {
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
  };
}
