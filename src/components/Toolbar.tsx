import { EditorActions } from "../hooks/useEditorActions";

interface ToolbarProps {
  actions: EditorActions;
}

interface ToolbarButton {
  label: string;
  title: string;
  onClick: () => void;
  bold?: boolean;
  italic?: boolean;
}

export default function Toolbar({ actions }: ToolbarProps) {
  const buttons: ToolbarButton[] = [
    { label: "B", title: "太字 (Ctrl+B)", onClick: actions.bold, bold: true },
    { label: "I", title: "斜体 (Ctrl+I)", onClick: actions.italic, italic: true },
    { label: "H1", title: "見出し1", onClick: () => actions.heading(1) },
    { label: "H2", title: "見出し2", onClick: () => actions.heading(2) },
    { label: "H3", title: "見出し3", onClick: () => actions.heading(3) },
    { label: "—", title: "箇条書き", onClick: actions.bulletList },
    { label: "1.", title: "番号リスト", onClick: actions.orderedList },
    { label: "`", title: "コード", onClick: actions.code },
    { label: "⊞", title: "テーブル挿入", onClick: actions.table },
  ];

  return (
    <div className="flex items-center gap-1 px-3 py-1 border-b border-zinc-200 dark:border-zinc-700 shrink-0">
      {buttons.map((btn) => (
        <button
          key={btn.label}
          title={btn.title}
          onMouseDown={(e) => e.preventDefault()}
          onClick={btn.onClick}
          className={[
            "px-2 py-0.5 text-sm rounded hover:bg-zinc-100 dark:hover:bg-zinc-800",
            "text-zinc-700 dark:text-zinc-300",
            btn.bold ? "font-bold" : "",
            btn.italic ? "italic" : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          {btn.label}
        </button>
      ))}
    </div>
  );
}
