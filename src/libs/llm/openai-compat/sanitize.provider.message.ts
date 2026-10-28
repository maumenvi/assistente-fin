/** Tamanho maximo de uma mensagem de erro do provedor repassada adiante. */
const MAX_LENGTH = 200;

/**
 * Limpa a mensagem de erro de um provedor antes de ela entrar num erro de dominio: remove chaves
 * (`sk-...`), tokens `Bearer ...`, quebras de linha e corta o tamanho. Provedores as vezes
 * devolvem o trecho da chave que receberam.
 */
export function sanitizeProviderMessage(message: string): string {
  const clean = message
    .replace(/sk-[A-Za-z0-9_-]{6,}/g, '[chave]')
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [chave]')
    .replace(/\s+/g, ' ')
    .trim();
  return clean.length > MAX_LENGTH ? `${clean.slice(0, MAX_LENGTH - 1)}…` : clean;
}
