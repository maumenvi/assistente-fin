import { escapeHtml } from './escape.html.ts';

/** Negrito e codigo em linha, sobre texto JA escapado. */
function inline(escaped: string): string {
  return escaped.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/`([^`]+)`/g, '<code>$1</code>');
}

/**
 * Markdown minimo (titulos `##`/`###`, listas `-`, negrito, codigo em linha, paragrafos) para HTML. Escapa TUDO antes de
 * formatar: nada de HTML do modelo ou dos dados chega ao arquivo (spec 040, FR-015).
 */
export function markdownToHtml(markdown: string): string {
  const out: string[] = [];
  let list: string[] = [];
  let paragraph: string[] = [];
  const flushList = (): void => {
    if (list.length > 0) out.push(`<ul>${list.map((item) => `<li>${item}</li>`).join('')}</ul>`);
    list = [];
  };
  const flushParagraph = (): void => {
    if (paragraph.length > 0) out.push(`<p>${paragraph.join('<br>')}</p>`);
    paragraph = [];
  };
  for (const raw of markdown.split('\n')) {
    const line = escapeHtml(raw.trim());
    const heading = /^(#{1,3})\s+(.+)$/.exec(line);
    const item = /^[-*]\s+(.+)$/.exec(line);
    if (line === '') {
      flushList();
      flushParagraph();
    } else if (heading !== null) {
      flushList();
      flushParagraph();
      const level = Math.min(4, (heading[1] as string).length + 1);
      out.push(`<h${String(level)}>${inline(heading[2] as string)}</h${String(level)}>`);
    } else if (item !== null) {
      flushParagraph();
      list.push(inline(item[1] as string));
    } else {
      flushList();
      paragraph.push(inline(line));
    }
  }
  flushList();
  flushParagraph();
  return out.join('\n');
}
