import { useEffect, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { readDir } from "@tauri-apps/plugin-fs";

interface TreeNode {
  name: string;
  path: string;
  isDirectory: boolean;
  isExpanded: boolean;
  children: TreeNode[] | null;
}

interface ExplorerProps {
  onOpenFile: (path: string) => void;
  width: number;
}

async function loadChildren(dirPath: string): Promise<TreeNode[]> {
  const entries = await readDir(dirPath);
  // Windows は "\" 、Unix は "/" — 親パスのセパレータに合わせる
  const sep = dirPath.includes("\\") ? "\\" : "/";
  const base = dirPath.replace(/[/\\]+$/, ""); // 末尾セパレータを除去
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

export default function Explorer({ onOpenFile, width }: ExplorerProps) {
  const [rootPath, setRootPath] = useState<string | null>(null);
  const [tree, setTree] = useState<TreeNode[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem("explorerPath");
    if (!saved) return;
    setRootPath(saved);
    loadChildren(saved).then(setTree).catch(() => {});
  }, []);

  const handleSelectFolder = async () => {
    const selected = await open({ directory: true });
    if (typeof selected !== "string") return;
    setRootPath(selected);
    localStorage.setItem("explorerPath", selected);
    const children = await loadChildren(selected);
    setTree(children);
  };

  const handleToggleNode = async (node: TreeNode) => {
    if (!node.isDirectory) {
      onOpenFile(node.path);
      return;
    }
    if (node.isExpanded) {
      setTree((prev) => updateNodeExpanded(prev, node.path, node.children ?? [], false));
      return;
    }
    try {
      const children = node.children === null ? await loadChildren(node.path) : node.children;
      setTree((prev) => updateNodeExpanded(prev, node.path, children, true));
    } catch (e) {
      console.error("フォルダ展開エラー:", node.path, e);
    }
  };

  const renderNodes = (nodes: TreeNode[], depth: number): React.ReactNode => {
    return nodes.map((node) => (
      <div key={node.path}>
        <button
          className="w-full text-left flex items-center gap-1 py-0.5 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded truncate"
          style={{ paddingLeft: depth * 12 + 8 }}
          onClick={() => handleToggleNode(node)}
          title={node.path}
        >
          <span className="shrink-0 text-xs">
            {node.isDirectory ? (node.isExpanded ? "▼" : "▶") : "　"}
          </span>
          <span className="truncate">{node.name}</span>
        </button>
        {node.isDirectory && node.isExpanded && node.children && (
          <div>{renderNodes(node.children, depth + 1)}</div>
        )}
      </div>
    ));
  };

  return (
    <div className="shrink-0 flex flex-col border-r border-zinc-200 dark:border-zinc-700 overflow-hidden" style={{ width }}>

      <div className="px-2 py-1 border-b border-zinc-200 dark:border-zinc-700 shrink-0">
        <button
          onClick={handleSelectFolder}
          className="w-full text-xs px-2 py-1 rounded border border-zinc-300 dark:border-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 truncate"
          title={rootPath ?? "フォルダを選択"}
        >
          {rootPath ? rootPath.split(/[\\/]/).pop() : "フォルダを選択"}
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-1 py-1">
        {tree.length === 0 && (
          <p className="text-xs text-zinc-400 px-2 py-2">
            {rootPath ? "空のフォルダ" : "フォルダを選択してください"}
          </p>
        )}
        {renderNodes(tree, 0)}
      </div>
    </div>
  );
}
