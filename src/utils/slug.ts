/**
 * 見出しテキストをHTMLアンカーIDに変換する
 * 小文字化・スペースをハイフンに置換・英数字と日本語以外を除去する
 * @param text - 変換元テキスト
 * @returns アンカーIDとして使用できるスラッグ文字列
 */
export function toSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\w\u3040-\u9fff-]/g, "");
}
