/** Tamanho maximo do titulo de uma conversa, em caracteres. */
const MAX_TITLE_LENGTH = 60;

/**
 * Titulo da conversa a partir da primeira pergunta: espacos e quebras de linha colapsados e
 * truncado em 60 caracteres (com reticencias dentro do limite). Texto vazio vira "Nova conversa".
 */
export function makeConversationTitle(text: string): string {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (normalized === '') return 'Nova conversa';
  if (normalized.length <= MAX_TITLE_LENGTH) return normalized;
  return `${normalized.slice(0, MAX_TITLE_LENGTH - 1).trimEnd()}…`;
}
