/** Janela (em tokens) ate a qual o modelo conta como "pequeno" (modelo local): compacta mais cedo. */
export const SMALL_WINDOW_TOKENS = 16_384;

/**
 * Fracao da janela que dispara a compactacao (spec 032, clarificacao 2026-10-22, FR-019): 70%, ou 50%
 * em modelo de janela pequena. Reavaliada a cada turno, entao uma troca de modelo vale na hora.
 */
export function compactionThreshold(contextWindow: number): number {
  return contextWindow <= SMALL_WINDOW_TOKENS ? 0.5 : 0.7;
}
