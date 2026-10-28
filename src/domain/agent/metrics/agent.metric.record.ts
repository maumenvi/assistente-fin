import { type ModelOrigin } from '../model.origin.ts';
import { type ModelRole } from '../model.role.ts';
import { type LlmTier } from '../routing/llm.tier.ts';
import { type RoutingStrategy } from '../routing/routing.strategy.ts';

/** Status do registro de metrica de uma chamada de LLM (spec 038, data-model.md 1.5). */
export type AgentMetricStatus = 'ok' | 'error' | 'limit_paused';

/**
 * Registro imutavel e permanente de telemetria de uso de LLM (spec 038, FR-019).
 * Persiste no banco de dados sem ON DELETE CASCADE em conversas/execucoes para preservar relatorios historicos.
 */
export interface AgentMetricRecord {
  readonly id: string;
  readonly userId: string;
  readonly runId: string;
  readonly conversationId: string;
  readonly strategy: RoutingStrategy;
  readonly tier: LlmTier;
  readonly role: ModelRole;
  readonly model: string;
  readonly origin: ModelOrigin;
  readonly node: string;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly cachedTokens: number;
  readonly costMicroUsd: number;
  /** Quanto este passo teria custado se executado no modelo de nivel 1o Alto (`high`). */
  readonly baselineHighCostMicroUsd: number;
  readonly durationMs: number;
  readonly status: AgentMetricStatus;
  readonly createdAt: string;
}

