import { type ModelPricing } from './model.pricing.ts';

/** Taxa de conversao padrao USD -> BRL para exibicao estimada em Reais (spec 038, FR-002). */
export const DEFAULT_USD_TO_BRL_RATE = 5.5;

/** Preco padrao de fallback para modelos de nuvem nao listados explicitamente (US$ 1,00 / US$ 3,00 por 1M). */
export const FALLBACK_CLOUD_PRICING: ModelPricing = Object.freeze({
  inputMicroUsdPer1M: 1_000_000,
  outputMicroUsdPer1M: 3_000_000,
  cachedMicroUsdPer1M: 250_000,
});

/** Preco zero para modelos locais (`openai_compat_local`, ex.: Ollama, llama.cpp). */
export const LOCAL_ZERO_PRICING: ModelPricing = Object.freeze({
  inputMicroUsdPer1M: 0,
  outputMicroUsdPer1M: 0,
  cachedMicroUsdPer1M: 0,
});

/**
 * Tabela oficial pre-configurada de precos por 1 milhao de tokens (spec 038, Clarificacao Q3 / FR-002).
 * Ordenada do match mais especifico para o mais geral.
 */
export const DEFAULT_MODEL_PRICING: readonly { readonly match: string; readonly pricing: ModelPricing }[] = Object.freeze([
  { match: 'claude-3-7-sonnet', pricing: { inputMicroUsdPer1M: 3_000_000, outputMicroUsdPer1M: 15_000_000, cachedMicroUsdPer1M: 300_000 } },
  { match: 'claude-sonnet', pricing: { inputMicroUsdPer1M: 3_000_000, outputMicroUsdPer1M: 15_000_000, cachedMicroUsdPer1M: 300_000 } },
  { match: 'claude-3-5-haiku', pricing: { inputMicroUsdPer1M: 800_000, outputMicroUsdPer1M: 4_000_000, cachedMicroUsdPer1M: 80_000 } },
  { match: 'claude-haiku', pricing: { inputMicroUsdPer1M: 800_000, outputMicroUsdPer1M: 4_000_000, cachedMicroUsdPer1M: 80_000 } },
  { match: 'gemini-2.5-pro', pricing: { inputMicroUsdPer1M: 1_250_000, outputMicroUsdPer1M: 10_000_000, cachedMicroUsdPer1M: 310_000 } },
  { match: 'gemini-pro', pricing: { inputMicroUsdPer1M: 1_250_000, outputMicroUsdPer1M: 10_000_000, cachedMicroUsdPer1M: 310_000 } },
  { match: 'gemini-2.5-flash', pricing: { inputMicroUsdPer1M: 150_000, outputMicroUsdPer1M: 600_000, cachedMicroUsdPer1M: 37_500 } },
  { match: 'gemini-3.8-flash', pricing: { inputMicroUsdPer1M: 150_000, outputMicroUsdPer1M: 600_000, cachedMicroUsdPer1M: 37_500 } },
  { match: 'gemini-flash', pricing: { inputMicroUsdPer1M: 150_000, outputMicroUsdPer1M: 600_000, cachedMicroUsdPer1M: 37_500 } },
  { match: 'gpt-4.1-nano', pricing: { inputMicroUsdPer1M: 100_000, outputMicroUsdPer1M: 400_000, cachedMicroUsdPer1M: 25_000 } },
  { match: 'gpt-4.1-mini', pricing: { inputMicroUsdPer1M: 400_000, outputMicroUsdPer1M: 1_600_000, cachedMicroUsdPer1M: 100_000 } },
  { match: 'gpt-4o-mini', pricing: { inputMicroUsdPer1M: 150_000, outputMicroUsdPer1M: 600_000, cachedMicroUsdPer1M: 75_000 } },
  { match: 'gpt-4.1', pricing: { inputMicroUsdPer1M: 2_000_000, outputMicroUsdPer1M: 8_000_000, cachedMicroUsdPer1M: 500_000 } },
  { match: 'gpt-4o', pricing: { inputMicroUsdPer1M: 2_500_000, outputMicroUsdPer1M: 10_000_000, cachedMicroUsdPer1M: 1_250_000 } },
  { match: 'llama-3', pricing: { inputMicroUsdPer1M: 100_000, outputMicroUsdPer1M: 400_000, cachedMicroUsdPer1M: 0 } },
  { match: 'qwen', pricing: { inputMicroUsdPer1M: 100_000, outputMicroUsdPer1M: 300_000, cachedMicroUsdPer1M: 0 } },
]);

