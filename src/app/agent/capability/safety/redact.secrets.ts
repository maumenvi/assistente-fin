const MASK = '•••';
const GENERIC: readonly RegExp[] = [/Bearer\s+[A-Za-z0-9._~+/=-]{8,}/g, /\bsk-[A-Za-z0-9_-]{16,}/g, /\b(?:api[_-]?key|token|password|senha|secret)\s*[:=]\s*\S+/gi];

/** Mascara credenciais conhecidas (valores exatos) e padroes comuns (`Bearer ...`, `sk-...`, `token=...`). */
export function redactSecrets(text: string, secrets: readonly string[] = []): string {
  let out = text;
  for (const secret of secrets) if (secret.length >= 4) out = out.split(secret).join(MASK);
  for (const re of GENERIC) out = out.replace(re, MASK);
  return out;
}
