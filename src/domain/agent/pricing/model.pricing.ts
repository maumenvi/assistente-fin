/**
 * Tabela de precos de um modelo em micro-dolares por 1 milhao de tokens (spec 038, FR-002).
 * 1 US$ = 1.000.000 micro-dolares. Para modelos locais (ex.: Ollama), todos os valores sao `0`.
 */
export interface ModelPricing {
  /** Micro-dolares por 1M de tokens de entrada (`>= 0`). */
  readonly inputMicroUsdPer1M: number;
  /** Micro-dolares por 1M de tokens de saida (`>= 0`). */
  readonly outputMicroUsdPer1M: number;
  /** Micro-dolares por 1M de tokens em cache (`>= 0`, padrao `0`). */
  readonly cachedMicroUsdPer1M?: number;
}

