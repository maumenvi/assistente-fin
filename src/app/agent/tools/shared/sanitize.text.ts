/** Tamanho maximo de um texto livre do usuario que entra no resultado de uma ferramenta. */
export const MAX_FREE_TEXT_CHARS = 120;

/**
 * Prepara um texto livre do usuario (descricao de lancamento, nome de conta...) para entrar num
 * resultado de ferramenta (spec 031, D13): remove caracteres de controle, neutraliza qualquer
 * `<dados>`/`</dados>` (que poderia fechar o bloco de dados e injetar instrucao), colapsa espacos
 * e corta em 120 caracteres (com reticencias dentro do limite). Nunca lanca.
 */
export function sanitizeText(text: string, max: number = MAX_FREE_TEXT_CHARS): string {
  const clean = text
    .replace(/[\u0000-\u001f\u007f-\u009f]+/g, ' ')
    .replace(/<\s*\/?\s*dados[^>]*>?/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  const chars = Array.from(clean);
  if (chars.length <= max) return clean;
  return `${chars.slice(0, max - 1).join('').trimEnd()}…`;
}
