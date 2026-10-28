/**
 * Particularidades do Google AI (interface compativel com OpenAI, spec 035, R4): os ids vem como `models/gemini-...`
 * e os erros HTTP chegam como LISTA `[{"error":{...}}]`. Funcoes puras, sem rede.
 */

/** `models/gemini-3.8-flash` -> `gemini-3.8-flash` (ids sem prefixo ficam como estao). */
export function normalizeModelId(id: string): string {
  return id.startsWith('models/') ? id.slice('models/'.length) : id;
}

/** Corpo de erro do Google: aceita o objeto `{error}` ou a lista `[{error}]`; devolve o primeiro `error` (ou `null`). */
export function unwrapErrorBody(body: unknown): unknown {
  return Array.isArray(body) ? (body[0] ?? null) : body;
}

/** Chave recusada pelo Google chega como HTTP 400 com "API key not valid" (nao como 401). */
export function isGoogleInvalidKeyMessage(message: string | null): boolean {
  return message !== null && /api key not valid|api_key_invalid|api key expired/i.test(message);
}

/** Cota esgotada do Google (429 `RESOURCE_EXHAUSTED` com texto de cota). */
export function isQuotaMessage(message: string | null): boolean {
  return message !== null && /quota|resource_exhausted|billing/i.test(message);
}
