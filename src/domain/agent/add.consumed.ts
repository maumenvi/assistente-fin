import { type Consumed } from './consumed.ts';

/** Soma dois consumos. Custo `null` + numero = numero; `null` + `null` = `null`. */
export function addConsumed(a: Consumed, b: Consumed): Consumed {
  const cost =
    a.costMicroUsd === null && b.costMicroUsd === null ? null : (a.costMicroUsd ?? 0) + (b.costMicroUsd ?? 0);
  return {
    steps: a.steps + b.steps,
    ms: a.ms + b.ms,
    inputTokens: a.inputTokens + b.inputTokens,
    outputTokens: a.outputTokens + b.outputTokens,
    cachedTokens: a.cachedTokens + b.cachedTokens,
    costMicroUsd: cost,
  };
}
