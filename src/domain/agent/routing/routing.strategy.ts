/**
 * Estrategias de roteamento dinamico entre os 3 tiers de LLM para coleta de metricas empiricas (spec 038, FR-017, FR-018):
 * - `hybrid_3_tiers`: Alto planeja e decide; Basico executa leituras simples; Medio classifica e monta tabelas.
 * - `tool_heuristic`: selecao estritamente pelo tipo de ferramenta chamada no passo.
 * - `progressive_escalation`: inicia no Basico e escala para Medio -> Alto conforme passos/incerteza.
 * - `single_high`: usa apenas o 1o Alto (linha de base de controle).
 */
export const ROUTING_STRATEGIES = [
  'hybrid_3_tiers',
  'tool_heuristic',
  'progressive_escalation',
  'single_high',
] as const;

/** Estrategia ativa de selecao de LLM no loop do agente. */
export type RoutingStrategy = (typeof ROUTING_STRATEGIES)[number];

