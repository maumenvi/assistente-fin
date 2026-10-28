/** Estimativa de tokens a partir de caracteres (~3,5 por token), ate haver a contagem do provedor. */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 3.5);
}
