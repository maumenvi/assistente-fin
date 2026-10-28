/** Le o JSON do resumo na resposta do modelo (puro, ou dentro de texto/cerca de codigo); `null` se nao houver. */
export function parseSummaryJson(text: string): unknown {
  const body = /\{[\s\S]*\}/.exec(text)?.[0];
  if (body === undefined) return null;
  try {
    return JSON.parse(body) as unknown;
  } catch {
    return null;
  }
}
