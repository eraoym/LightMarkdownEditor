/**
 * 文書先頭の YAML front matter（--- ... --- で囲まれた部分）を除去する
 */
export function stripFrontMatter(markdown: string): string {
  if (!/^---[ \t]*\r?\n/.test(markdown)) return markdown;
  const rest = markdown.slice(markdown.indexOf("\n") + 1);
  const match = rest.match(/^---[ \t]*(\r?\n|$)/m);
  if (!match || match.index === undefined) return markdown;
  return rest.slice(match.index + match[0].length);
}
