export function toSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\w\u3040-\u9fff-]/g, "");
}
