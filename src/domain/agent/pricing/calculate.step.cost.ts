import { DEFAULT_USD_TO_BRL_RATE } from './default.model.pricing.ts';
import { type ModelPricing } from './model.pricing.ts';

/**
 * Calcula de forma deterministica o custo de um passo/chamada de LLM em micro-dolares (spec 038, FR-002).
 * Arredonda para o inteiro mais proximo para evitar erro de ponto flutuante.
 */
export function calculateStepCost(
  tokens: { readonly inputTokens: number; readonly outputTokens: number; readonly cachedTokens?: number },
  pricing: ModelPricing,
): number {
  const input = Math.max(0, tokens.inputTokens);
  const output = Math.max(0, tokens.outputTokens);
  const cached = Math.max(0, tokens.cachedTokens ?? 0);
  const billableInput = Math.max(0, input - cached);
  const cost =
    (billableInput * pricing.inputMicroUsdPer1M +
      output * pricing.outputMicroUsdPer1M +
      cached * (pricing.cachedMicroUsdPer1M ?? 0)) /
    1_000_000;
  return Math.round(cost);
}

/** Formata um valor em micro-dolares para texto em Reais (`R$ 0,18`), usando a cotacao informada ou padrao. */
export function microUsdToBrlString(microUsd: number, usdToBrlRate: number = DEFAULT_USD_TO_BRL_RATE): string {
  const brl = (Math.max(0, microUsd) / 1_000_000) * usdToBrlRate;
  return `R$ ${brl.toFixed(2).replace('.', ',')}`;
}

