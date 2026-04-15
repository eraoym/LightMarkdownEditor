import { useEffect, useState } from "react";
import { readFile } from "@tauri-apps/plugin-fs";

interface PdfViewerProps {
  filePath: string;
}

/**
 * PDF ファイルを参照専用で表示するコンポーネント
 * readFile でバイナリ読み込み → Blob URL → iframe で WebView2 のネイティブ PDF レンダリングを利用
 */
export default function PdfViewer({ filePath }: PdfViewerProps) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let url: string | null = null;

    (async () => {
      try {
        const bytes = await readFile(filePath);
        const blob = new Blob([bytes], { type: "application/pdf" });
        url = URL.createObjectURL(blob);
        setBlobUrl(url);
        setError(null);
      } catch {
        setError("PDF を読み込めませんでした");
      }
    })();

    // タブ切替・コンポーネントアンマウント時に Blob URL を解放
    return () => {
      if (url) URL.revokeObjectURL(url);
      setBlobUrl(null);
    };
  }, [filePath]);

  if (error) {
    return (
      <div className="flex items-center justify-center w-full h-full text-zinc-500 dark:text-zinc-400 text-sm p-8">
        {error}
      </div>
    );
  }

  if (!blobUrl) {
    return (
      <div className="flex items-center justify-center w-full h-full text-zinc-400 text-sm">
        読み込み中...
      </div>
    );
  }

  return (
    <iframe
      src={blobUrl}
      className="w-full h-full border-0"
      title="PDF ビューア"
    />
  );
}
