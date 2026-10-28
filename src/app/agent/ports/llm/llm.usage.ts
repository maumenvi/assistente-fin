/** Uso reportado pelo provedor numa geracao. O custo vem em micro-dolares quando o provedor informa. */
export interface LlmUsage {
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly cachedTokens?: number;
  readonly costMicroUsd?: number;
}
