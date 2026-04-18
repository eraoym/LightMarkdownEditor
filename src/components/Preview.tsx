import { useEffect, useRef, useState, Children, cloneElement, isValidElement } from "react";
import type { ReactElement, InputHTMLAttributes } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import { readFile } from "@tauri-apps/plugin-fs";
import { openUrl } from "@tauri-apps/plugin-opener";
import mermaid from "mermaid";
import hljs from "highlight.js";
import { toSlug } from "../utils/slug";
import { stripFrontMatter } from "../utils/frontMatter";
import type { PreviewTheme } from "../types";
import githubCss from "../styles/themes/github.css?raw";
import minimalCss from "../styles/themes/minimal.css?raw";
import academicCss from "../styles/themes/academic.css?raw";

const THEME_CSS: Record<PreviewTheme, string> = {
  github: githubCss,
  minimal: minimalCss,
  academic: academicCss,
};

type MediaViewerContent =
  | { type: "image"; src: string; alt?: string }
  | { type: "svg"; html: string };

function MediaViewer({ content, onClose }: { content: MediaViewerContent; onClose: () => void }) {
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ mouseX: number; mouseY: number; ox: number; oy: number } | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  // wheel イベントは passive: false で登録しないと WebView2 で preventDefault が無視される
  useEffect(() => {
    const el = overlayRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      setZoom((z) => Math.min(10, Math.max(0.1, z + delta)));
    };
    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDragging(true);
    dragStartRef.current = { mouseX: e.clientX, mouseY: e.clientY, ox: offset.x, oy: offset.y };
  };
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !dragStartRef.current) return;
    const { mouseX, mouseY, ox, oy } = dragStartRef.current;
    setOffset({ x: ox + (e.clientX - mouseX), y: oy + (e.clientY - mouseY) });
  };
  const handleMouseUp = () => { setIsDragging(false); dragStartRef.current = null; };
  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  };

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
      onClick={onClose}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <button
        className="absolute top-4 right-4 text-white/80 hover:text-white text-2xl leading-none z-10"
        onClick={onClose}
      >
        ✕
      </button>
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/50 text-xs pointer-events-none select-none">
        ホイール: ズーム　ドラッグ: 移動　ダブルクリック: リセット
      </div>
      <div
        style={{
          transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
          cursor: isDragging ? "grabbing" : "grab",
          userSelect: "none",
        }}
        onClick={(e) => e.stopPropagation()}
        onMouseDown={handleMouseDown}
        onDoubleClick={handleDoubleClick}
      >
        {content.type === "image" ? (
          <img
            src={content.src}
            alt={content.alt ?? ""}
            style={{ maxWidth: "90vw", maxHeight: "90vh", display: "block" }}
            draggable={false}
          />
        ) : (
          <div
            className="bg-white rounded p-2"
            dangerouslySetInnerHTML={{ __html: content.html }}
            style={{ maxWidth: "90vw", maxHeight: "90vh" }}
          />
        )}
      </div>
    </div>
  );
}

interface PreviewProps {
  markdown: string;
  filePath: string | null;
  isDark: boolean;
  previewTheme: PreviewTheme;
  scrollRef?: React.RefObject<HTMLDivElement | null>;
  onCheckboxToggle?: (index: number) => void;
}

function MermaidDiagram({ code, isDark, onOpenViewer }: { code: string; isDark: boolean; onOpenViewer: (c: MediaViewerContent) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  // IDはマウント時に1度だけ確定させる（再レンダリングごとに新IDを生成しない）
  const idRef = useRef(`mermaid-${Math.random().toString(36).slice(2)}`);

  useEffect(() => {
    if (!ref.current) return;

    // 前回の描画結果をクリア（エラーメッセージ・SVGの累積を防ぐ）
    ref.current.innerHTML = "";

    // アンマウント後の非同期コールバック実行を防ぐフラグ
    let cancelled = false;

    mermaid.initialize({ startOnLoad: false, theme: isDark ? "dark" : "default" });

    mermaid
      .render(idRef.current, code)
      .then(({ svg }) => {
        if (cancelled || !ref.current) return;
        ref.current.innerHTML = svg;
        // mermaid が SVG に付与するインライン background スタイルを除去し
        // ページの背景色に合わせる（ライト/ダーク共通）
        const svgEl = ref.current.querySelector("svg");
        if (svgEl) svgEl.style.background = "transparent";
      })
      .catch(() => {
        if (cancelled || !ref.current) return;
        // エラー時も前回SVGをクリアしてからメッセージを設定
        ref.current.innerHTML = "";
        ref.current.textContent = "mermaid 描画エラー";
      });

    return () => {
      cancelled = true;
    };
  }, [code, isDark]);

  return (
    <div
      ref={ref}
      className="mermaid-diagram"
      style={{ cursor: "zoom-in" }}
      onClick={() => {
        if (!ref.current) return;
        const svgEl = ref.current.querySelector("svg");
        if (!svgEl) return;
        onOpenViewer({ type: "svg", html: svgEl.outerHTML });
      }}
    />
  );
}

function ImageRenderer({
  src,
  alt,
  filePath,
  onOpenViewer,
}: {
  src?: string;
  alt?: string;
  filePath: string | null;
  onOpenViewer: (c: MediaViewerContent) => void;
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

  return (
    <img
      src={resolvedSrc}
      alt={alt ?? ""}
      style={{ maxWidth: "100%", cursor: resolvedSrc ? "zoom-in" : "default" }}
      draggable={false}
      onClick={() => { if (resolvedSrc) onOpenViewer({ type: "image", src: resolvedSrc, alt }); }}
    />
  );
}

function extractText(node: React.ReactNode): string {
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(extractText).join("");
  if (node !== null && typeof node === "object" && "props" in node)
    return extractText((node as React.ReactElement<{ children?: React.ReactNode }>).props.children);
  return "";
}

function headingId(children: React.ReactNode): string {
  return toSlug(extractText(children));
}

export default function Preview({ markdown, filePath, isDark, previewTheme, scrollRef, onCheckboxToggle }: PreviewProps) {
  const [viewerContent, setViewerContent] = useState<MediaViewerContent | null>(null);

  return (
    <div ref={scrollRef} className="print-area w-full h-full overflow-y-auto p-4 prose prose-zinc dark:prose-invert max-w-none">
      <style>{THEME_CSS[previewTheme]}</style>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw]}
        components={{
          code({ className, children }) {
            const language = className?.replace("language-", "");

            if (language === "mermaid") {
              return <MermaidDiagram code={String(children)} isDark={isDark} onOpenViewer={setViewerContent} />;
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
          a({ href, children }) {
            return (
              <a
                href={href}
                onClick={(e) => {
                  e.preventDefault();
                  if (href) openUrl(href).catch(console.error);
                }}
              >
                {children}
              </a>
            );
          },
          img({ src, alt }) {
            return <ImageRenderer src={src} alt={alt} filePath={filePath} onOpenViewer={setViewerContent} />;
          },
          li({ node, children, className }) {
            const isTaskItem = className?.toString().includes("task-list-item");
            if (!isTaskItem || !onCheckboxToggle) {
              return <li className={className}>{children}</li>;
            }
            const line = (node as any)?.position?.start?.line as number | undefined;
            return (
              <li className={className}>
                {Children.map(children, (child) => {
                  if (isValidElement(child) && (child as ReactElement<InputHTMLAttributes<HTMLInputElement>>).type === "input") {
                    return cloneElement(child as ReactElement<InputHTMLAttributes<HTMLInputElement>>, {
                      disabled: false,
                      onChange: () => line !== undefined && onCheckboxToggle(line),
                    });
                  }
                  return child;
                })}
              </li>
            );
          },
          h1({ children }) { return <h1 id={headingId(children)}>{children}</h1>; },
          h2({ children }) { return <h2 id={headingId(children)}>{children}</h2>; },
          h3({ children }) { return <h3 id={headingId(children)}>{children}</h3>; },
          h4({ children }) { return <h4 id={headingId(children)}>{children}</h4>; },
          h5({ children }) { return <h5 id={headingId(children)}>{children}</h5>; },
          h6({ children }) { return <h6 id={headingId(children)}>{children}</h6>; },
        }}
      >
        {stripFrontMatter(markdown)}
      </ReactMarkdown>

      {viewerContent && (
        <MediaViewer content={viewerContent} onClose={() => setViewerContent(null)} />
      )}
    </div>
  );
}
