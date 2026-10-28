/**
 * Texto de um `delta.content`: string simples ou lista de partes (`{ type: 'text', text }`), formato
 * que alguns provedores usam (spec 037, FR-015). Partes sem texto (imagem etc.) sao ignoradas.
 */
export function contentText(content: string | readonly unknown[] | null | undefined): string {
  if (content === null || content === undefined) return '';
  if (typeof content === 'string') return content;
  let text = '';
  for (const part of content) {
    if (typeof part === 'string') text += part;
    else if (typeof part === 'object' && part !== null && typeof (part as { text?: unknown }).text === 'string') {
      text += (part as { text: string }).text;
    }
  }
  return text;
}
