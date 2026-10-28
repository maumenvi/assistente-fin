/**
 * Texto de anexo que entra no prompt: tira caracteres de controle (menos quebra de linha) e neutraliza qualquer
 * `<dado_externo>`/`<dados>` que tentasse fechar o bloco e injetar instrucao (spec 036/034). Nunca lanca.
 */
export function sanitizeAttachmentText(text: string): string {
  return text
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0009\u000b-\u001f\u007f-\u009f]+/g, ' ')
    .replace(/<\s*\/?\s*(dado_externo|dados)[^>]*>?/gi, '')
    .replace(/[ \t]+/g, ' ');
}

/** Uma celula de tabela, em uma linha, cortada em `max` caracteres. */
export function sanitizeCell(text: string, max = 160): string {
  const clean = sanitizeAttachmentText(text).replace(/\s+/g, ' ').trim();
  return clean.length <= max ? clean : `${clean.slice(0, max - 1).trimEnd()}…`;
}
