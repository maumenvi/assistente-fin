/**
 * Hash FNV-1a de 64 bits em hex (dominio puro, sem cripto): identifica a MESMA notificacao
 * entregue duas vezes pelo sistema. Nao e seguranca.
 */
export function hashText(text: string): string {
  let hash = 0xcbf29ce484222325n;
  for (const char of text) {
    hash ^= BigInt(char.codePointAt(0) ?? 0);
    hash = (hash * 0x100000001b3n) & 0xffffffffffffffffn;
  }
  return hash.toString(16).padStart(16, '0');
}
