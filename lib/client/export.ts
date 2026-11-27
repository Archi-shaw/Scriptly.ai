"use client";

import { createElement } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { markdownToPlainText } from "@/lib/text";

export type ExportFormat = "md" | "txt" | "html" | "doc" | "pdf";

export function slugify(title: string): string {
  return (
    title
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "scriptly-document"
  );
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c);
}

/** Renders Markdown to HTML with the same safe renderer as the preview (raw HTML is not allowed). */
export function markdownToHtml(markdown: string): string {
  const container = document.createElement("div");
  const root = createRoot(container);
  flushSync(() => {
    root.render(createElement(ReactMarkdown, { remarkPlugins: [remarkGfm] }, markdown));
  });
  const html = container.innerHTML;
  root.unmount();
  return html;
}

const DOCUMENT_STYLES = `
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; max-width: 760px; margin: 40px auto; padding: 0 24px; line-height: 1.65; color: #1b1630; }
  h1, h2, h3, h4 { line-height: 1.25; margin: 1.4em 0 0.5em; }
  p, ul, ol, table, blockquote { margin: 0 0 1em; }
  table { border-collapse: collapse; width: 100%; }
  th, td { border: 1px solid #d9d4e7; padding: 6px 10px; text-align: left; }
  blockquote { border-left: 3px solid #7c3aed; padding-left: 16px; color: #4b4560; }
  code { background: #f4f2fa; padding: 2px 4px; border-radius: 4px; }
  pre { background: #f4f2fa; padding: 12px; border-radius: 8px; overflow: auto; }
  a { color: #6d28d9; }
`;

function htmlDocument(title: string, bodyHtml: string, wordCompatible = false): string {
  const htmlTag = wordCompatible
    ? `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">`
    : `<html lang="en">`;
  return `<!doctype html>
${htmlTag}
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)}</title>
<style>${DOCUMENT_STYLES}</style>
</head>
<body>
${bodyHtml}
</body>
</html>`;
}

function download(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function printHtml(html: string) {
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.style.position = "fixed";
  frame.style.width = "0";
  frame.style.height = "0";
  frame.style.border = "0";
  document.body.appendChild(frame);
  const doc = frame.contentDocument;
  const win = frame.contentWindow;
  if (!doc || !win) {
    frame.remove();
    throw new Error("Printing isn't available in this browser.");
  }
  doc.open();
  doc.write(html);
  doc.close();
  setTimeout(() => {
    win.focus();
    win.print();
    setTimeout(() => frame.remove(), 1000);
  }, 250);
}

export function exportContent(format: ExportFormat, title: string, markdown: string) {
  const name = slugify(title);
  switch (format) {
    case "md":
      return download(`${name}.md`, markdown, "text/markdown;charset=utf-8");
    case "txt":
      return download(`${name}.txt`, markdownToPlainText(markdown), "text/plain;charset=utf-8");
    case "html":
      return download(`${name}.html`, htmlDocument(title, markdownToHtml(markdown)), "text/html;charset=utf-8");
    case "doc":
      // Word opens HTML saved with the Office namespaces and a .doc extension.
      return download(`${name}.doc`, `﻿${htmlDocument(title, markdownToHtml(markdown), true)}`, "application/msword");
    case "pdf":
      return printHtml(htmlDocument(title, markdownToHtml(markdown)));
  }
}

export async function copyToClipboard(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const area = document.createElement("textarea");
  area.value = text;
  area.style.position = "fixed";
  area.style.opacity = "0";
  document.body.appendChild(area);
  area.select();
  const ok = document.execCommand("copy");
  area.remove();
  if (!ok) throw new Error("Copy failed");
}
