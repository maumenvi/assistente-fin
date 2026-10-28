/**
 * O que um modelo sabe fazer (spec 031, FR-024). O agente se adapta a isto: sem `tools` ele so
 * conversa; sem `structuredOutput` o roteador usa regras e parse tolerante.
 */
export interface ModelCapabilities {
  /** *Tool calling* confiavel (confirmado pela sonda do teste de conexao). */
  readonly tools: boolean;
  /** Aceita varias chamadas de ferramenta no mesmo turno. */
  readonly parallelToolCalls: boolean;
  readonly vision: boolean;
  /** Aceita `response_format` com JSON Schema. */
  readonly structuredOutput: boolean;
  /** Janela de contexto, em tokens. */
  readonly contextWindow: number;
  readonly promptCache: 'none' | 'implicit' | 'explicit';
  readonly reasoning: boolean;
  /** Quando a sonda confirmou as capacidades; `null` = nunca verificado. */
  readonly verifiedAt: string | null;
}
