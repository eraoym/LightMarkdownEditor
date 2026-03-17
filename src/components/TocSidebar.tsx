import { useMemo } from "react";
import { toSlug } from "../utils/slug";

interface Heading {
  level: number;
  text: string;
  id: string;
}

function extractHeadings(markdown: string): Heading[] {
  const results: Heading[] = [];
  const regex = /^(#{1,6})\s+(.+)$/gm;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(markdown)) !== null) {
    const text = match[2].trim();
    results.push({ level: match[1].length, text, id: toSlug(text) });
  }
  return results;
}

export default function TocSidebar({
  markdown,
  width,
}: {
  markdown: string;
  width: number;
}) {
  const headings = useMemo(() => extractHeadings(markdown), [markdown]);

  return (
    <div
      style={{ width }}
      className="flex-shrink-0 overflow-y-auto border-l border-zinc-200 dark:border-zinc-700 p-3"
    >
      <div className="text-xs font-semibold text-zinc-500 mb-2">目次</div>
      {headings.length === 0 ? (
        <div className="text-xs text-zinc-400">見出しなし</div>
      ) : (
        <ul className="text-sm space-y-1">
          {headings.map((h, i) => (
            <li key={i} style={{ paddingLeft: (h.level - 1) * 12 }}>
              <span
                className="text-zinc-700 dark:text-zinc-300 hover:text-blue-500 cursor-pointer truncate block"
                onClick={() =>
                  document.getElementById(h.id)?.scrollIntoView({ behavior: "smooth", block: "start" })
                }
              >
                {h.text}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
