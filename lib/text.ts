/** Text helpers shared by server and client. */

const CJK = /[぀-ヿ㐀-䶿一-鿿가-힯豈-﫿]/g;

/** Approximate word count; CJK characters count as one word each. */
export function countWords(text: string): number {
  if (!text) return 0;
  const cjk = text.match(CJK)?.length ?? 0;
  const words = text
    .replace(CJK, " ")
    .split(/\s+/)
    .filter((token) => /[\p{L}\p{N}]/u.test(token)).length;
  return words + cjk;
}

export function readingTimeMinutes(text: string): number {
  return Math.max(1, Math.round(countWords(text) / 230));
}

/** Converts Markdown to readable plain text (for .txt export and previews). */
export function markdownToPlainText(markdown: string): string {
  return markdown
    .replace(/\r\n/g, "\n")
    .replace(/```[a-z]*\n?([\s\S]*?)```/gi, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1 ($2)")
    .replace(/^#{1,6}[ \t]+/gm, "")
    .replace(/^[ \t]*>[ \t]?/gm, "")
    .replace(/(\*\*|__)(.*?)\1/g, "$2")
    .replace(/(^|[^*\w])\*(?!\s)([^*\n]+?)\*(?!\w)/g, "$1$2")
    .replace(/(^|[^_\w])_(?!\s)([^_\n]+?)_(?!\w)/g, "$1$2")
    .replace(/~~(.*?)~~/g, "$1")
    .replace(/^[ \t]*[-*+][ \t]+/gm, "• ")
    .replace(/^[ \t]*(-{3,}|\*{3,}|_{3,})[ \t]*$/gm, "")
    .replace(/^\|?([ \t]*:?-{2,}:?[ \t]*\|)+[ \t]*:?-{0,}:?[ \t]*$/gm, "")
    .replace(/\|/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Short single-line preview of content. */
export function excerpt(markdown: string, maxLength = 180): string {
  const plain = markdownToPlainText(markdown).replace(/\s+/g, " ").trim();
  return plain.length > maxLength ? `${plain.slice(0, maxLength - 1).trimEnd()}…` : plain;
}

/** Derives a document title from content (first heading or first line). */
export function deriveTitle(markdown: string, fallback = "Untitled document"): string {
  const heading = markdown.match(/^#{1,3}\s+(.+)$/m)?.[1];
  const firstLine = markdownToPlainText(markdown).split("\n").find((line) => line.trim().length > 0);
  const title = (heading ?? firstLine ?? "").replace(/[*_`#]/g, "").trim();
  if (!title) return fallback;
  return title.length > 90 ? `${title.slice(0, 89).trimEnd()}…` : title;
}
