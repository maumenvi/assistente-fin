/** Marcador no lugar de um segredo. */
const MASK = '[REDACTED]';

/** Profundidade maxima percorrida (protege contra estruturas enormes). */
const MAX_DEPTH = 8;

/** Chaves cujo valor e sempre mascarado: authorization, apiKey, key*, token*, secret*, password*. */
const SECRET_KEY = /^(authorization|api[-_]?key|key.*|.*[-_]key|token.*|.*token|secret.*|password.*|passwd)$/i;

/** Mascara chaves de API (`sk-...`) e tokens `Bearer` dentro de um texto. */
function redactString(text: string): string {
  return text.replace(/sk-[A-Za-z0-9_-]{6,}/g, MASK).replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, `Bearer ${MASK}`);
}

function walk(value: unknown, depth: number, seen: WeakSet<object>): unknown {
  if (typeof value === 'string') return redactString(value);
  if (typeof value === 'function') return '[function]';
  if (typeof value !== 'object' || value === null) return value;
  if (value instanceof Date) return value.toISOString();
  if (seen.has(value)) return '[circular]';
  if (depth >= MAX_DEPTH) return '[profundo demais]';
  seen.add(value);
  if (value instanceof Error) {
    return { name: value.name, message: redactString(value.message), stack: value.stack ? redactString(value.stack) : null };
  }
  if (Array.isArray(value)) return value.map((item) => walk(item, depth + 1, seen));
  const out: Record<string, unknown> = {};
  for (const [key, inner] of Object.entries(value)) {
    out[key] = SECRET_KEY.test(key) && inner !== null && inner !== undefined ? MASK : walk(inner, depth + 1, seen);
  }
  return out;
}

/**
 * Remove segredos de um valor antes de ele ir para log, trace ou mensagem (spec 031, SC-009):
 * mascara chaves de objeto com cara de segredo (`authorization`, `apiKey`, `key*`, `token*`,
 * `secret*`, `password*`) e valores que casem `sk-...` ou `Bearer ...`, recursivamente. NAO muta a
 * entrada e nunca lanca.
 */
export function redact(value: unknown): unknown {
  try {
    return walk(value, 0, new WeakSet());
  } catch {
    return MASK;
  }
}
