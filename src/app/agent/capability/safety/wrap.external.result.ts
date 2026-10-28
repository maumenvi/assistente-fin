/** Teto do texto de capacidade externa que chega ao modelo (FR-012). */
export const EXTERNAL_RESULT_MAX_CHARS = 6000;

export interface WrappedResult {
  readonly text: string;
  readonly truncated: boolean;
}

/**
 * Resultado externo e DADO, nunca instrucao (spec 034, FR-009): neutraliza `<dados`/`</dados` dentro do
 * texto (para ele nao fechar o envelope), remove controles, trunca e embrulha em `<dados origem="...">`.
 */
export function wrapExternalResult(origin: string, text: string, maxChars = EXTERNAL_RESULT_MAX_CHARS): WrappedResult {
  const open = `<dados origem="${origin.replace(/[^A-Za-z0-9:._-]/g, '_')}">\n`;
  const close = '\n</dados>';
  const note = '\n[resultado cortado]';
  const clean = text
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
    .replace(/<\s*\/?\s*dados/gi, '‹dados');
  const room = maxChars - open.length - close.length;
  const truncated = clean.length > room;
  const body = truncated ? `${clean.slice(0, Math.max(0, room - note.length))}${note}` : clean;
  return { text: `${open}${body}${close}`, truncated };
}
