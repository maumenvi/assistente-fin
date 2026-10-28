/**
 * Niveis (tiers) das 3 LLMs do agente por ordem de preferencia e complexidade (spec 038, FR-016):
 * - `high` (1o · Alto): planejamento, raciocinio avancado e decisoes criticas.
 * - `medium` (2o · Medio): classificacao, formatacao em tabelas e analise intermediaria.
 * - `basic` (3o · Basico): consultas diretas, triagem rapida e leitura leve.
 */
export const LLM_TIERS = ['high', 'medium', 'basic'] as const;

/** Nivel de capacidade da LLM no roteamento em 3 camadas. */
export type LlmTier = (typeof LLM_TIERS)[number];

