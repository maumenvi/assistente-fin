import { type Consumed } from './consumed.ts';

/** Consumo zerado, ponto de partida de uma execucao. */
export const EMPTY_CONSUMED: Consumed = Object.freeze({
  steps: 0,
  ms: 0,
  inputTokens: 0,
  outputTokens: 0,
  cachedTokens: 0,
  costMicroUsd: null,
});
