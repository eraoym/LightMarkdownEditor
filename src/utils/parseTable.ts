/**
 * 区切り文字付きテキストをMarkdownテーブル形式に変換する
 * @param text - 変換元テキスト（1行目をヘッダとして扱う）
 * @param delimiter - 列の区切り文字（例: `","` や `"\t"`）
 * @returns Markdown テーブル文字列
 */
export function parseToMarkdownTable(text: string, delimiter: string): string {
  const lines = text.trim().split("\n").map(line =>
    line.split(delimiter).map(cell => cell.trim())
  );
  if (lines.length === 0) return "";
  const header = lines[0];
  const sep = header.map(() => "---");
  const body = lines.slice(1);
  const toRow = (cells: string[]) => `| ${cells.join(" | ")} |`;
  return [toRow(header), toRow(sep), ...body.map(toRow)].join("\n");
}
