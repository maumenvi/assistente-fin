import { INTENTS, type Intent } from '../../../../domain/agent/intent.ts';

/** Confianca minima para aceitar a classificacao do modelo; abaixo disso vira consulta. */
const MIN_CONFIDENCE = 0.5;

function asIntent(value: unknown): Intent | null {
  return typeof value === 'string' && (INTENTS as readonly string[]).includes(value) ? (value as Intent) : null;
}

/**
 * Le a saida do classificador de forma tolerante: JSON puro, JSON dentro de texto/cerca de
 * codigo ou, na falta, a primeira intencao citada no texto. Confianca baixa ou ilegivel -> `null`
 * (quem chama cai em `query`).
 */
export function parseRouterOutput(text: string): Intent | null {
  const objectText = /\{[\s\S]*\}/.exec(text)?.[0];
  if (objectText !== undefined) {
    try {
      const parsed = JSON.parse(objectText) as { intent?: unknown; confidence?: unknown };
      const intent = asIntent(parsed.intent);
      if (intent === null) return null;
      const confidence = typeof parsed.confidence === 'number' ? parsed.confidence : 1;
      return confidence >= MIN_CONFIDENCE ? intent : null;
    } catch {
      // cai para a busca por palavra
    }
  }
  const found = INTENTS.find((intent) => new RegExp(`\\b${intent}\\b`).test(text));
  return found ?? null;
}
