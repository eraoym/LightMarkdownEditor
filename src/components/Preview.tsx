import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { readFile } from "@tauri-apps/plugin-fs";
import mermaid from "mermaid";
import hljs from "highlight.js";
import { toSlug } from "../utils/slug";

interface PreviewProps {
  markdown: string;
  filePath: string | null;
  isDark: boolean;
}

function MermaidDiagram({ code, isDark }: { code: string; isDark: boolean }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    mermaid.initialize({ startOnLoad: false, theme: isDark ? "dark" : "default" });
    const id = `mermaid-${Math.random().toString(36).slice(2)}`;
    mermaid.render(id, code).then(({ svg }) => {
      if (ref.current) {
        ref.current.innerHTML = svg;
        // mermaid が SVG に付与するインライン background スタイルを除去し
        // ページの背景色に合わせる（ライト/ダーク共通）
        const svgEl = ref.current.querySelector("svg");
        if (svgEl) svgEl.style.background = "transparent";
      }
    }).catch(() => {
      if (ref.current) ref.current.textContent = "mermaid 描画エラー";
    });
  }, [code, isDark]);

  return <div ref={ref} className="mermaid-diagram" />;
}

function ImageRenderer({
  src,
  alt,
  filePath,
}: {
  src?: string;
  alt?: string;
  filePath: string | null;
}) {
  const [resolvedSrc, setResolvedSrc] = useState(src ?? "");

  useEffect(() => {
    if (!src || src.startsWith("http") || src.startsWith("data:")) {
      setResolvedSrc(src ?? "");
      return;
    }
    if (!filePath) return;
    const dir = filePath.replace(/[/\\][^/\\]*$/, "");
    const sep = filePath.includes("\\") ? "\\" : "/";
    const absPath = src.startsWith("/") ? src : dir + sep + src;
    readFile(absPath)
      .then((bytes) => {
        const ext = absPath.split(".").pop()?.toLowerCase() ?? "png";
        const mimeMap: Record<string, string> = {
          jpg: "jpeg",
          jpeg: "jpeg",
          png: "png",
          gif: "gif",
          webp: "webp",
          svg: "svg+xml",
        };
        const mime = `image/${mimeMap[ext] ?? "png"}`;
        // スプレッド構文はスタックオーバーフローになるためループで変換
        let binary = "";
        for (let i = 0; i < bytes.length; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        setResolvedSrc(`data:${mime};base64,${btoa(binary)}`);
      })
      .catch((err) => {
        console.error("[Preview] 画像読み込みエラー:", absPath, err);
        setResolvedSrc("");
      });
  }, [src, filePath]);

  return <img src={resolvedSrc} alt={alt ?? ""} style={{ maxWidth: "100%" }} />;
}

function headingId(children: React.ReactNode): string {
  const text = Array.isArray(children)
    ? children.map((c) => (typeof c === "string" ? c : "")).join("")
    : typeof children === "string"
    ? children
    : "";
  return toSlug(text);
}

export default function Preview({ markdown, filePath, isDark }: PreviewProps) {
  return (
    <div className="print-area w-full h-full overflow-y-auto p-4 prose prose-zinc dark:prose-invert max-w-none">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({ className, children }) {
            const language = className?.replace("language-", "");

            if (language === "mermaid") {
              return <MermaidDiagram code={String(children)} isDark={isDark} />;
            }

            // インラインコード（className なし）はそのまま
            if (!className) {
              return <code>{children}</code>;
            }

            // ブロックコード: シンタックスハイライト
            const raw = String(children).replace(/\n$/, "");
            const lang = language && hljs.getLanguage(language) ? language : undefined;
            const result = lang
              ? hljs.highlight(raw, { language: lang })
              : hljs.highlightAuto(raw);

            return (
              <code
                className={`hljs${lang ? ` language-${lang}` : ""}`}
                dangerouslySetInnerHTML={{ __html: result.value }}
              />
            );
          },
          img({ src, alt }) {
            return <ImageRenderer src={src} alt={alt} filePath={filePath} />;
          },
          h1({ children }) { return <h1 id={headingId(children)}>{children}</h1>; },
          h2({ children }) { return <h2 id={headingId(children)}>{children}</h2>; },
          h3({ children }) { return <h3 id={headingId(children)}>{children}</h3>; },
          h4({ children }) { return <h4 id={headingId(children)}>{children}</h4>; },
          h5({ children }) { return <h5 id={headingId(children)}>{children}</h5>; },
          h6({ children }) { return <h6 id={headingId(children)}>{children}</h6>; },
        }}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  );
}
