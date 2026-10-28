import { type AgentMetricRecord } from '../../../../domain/agent/metrics/agent.metric.record.ts';
import { type RoutingStrategy } from '../../../../domain/agent/routing/routing.strategy.ts';

/** Filtros opcionais para consulta de metricas historicas (spec 038, FR-020). */
export interface AgentMetricFilter {
  readonly fromIso?: string;
  readonly toIso?: string;
  readonly strategy?: RoutingStrategy;
  readonly model?: string;
  readonly conversationId?: string;
}

/**
 * Porta de persistencia permanente de metricas de uso das LLMs (spec 038, FR-019).
 * Nunca e apagada quando conversas ou execucoes sao removidas pelo usuario.
 */
export interface AgentMetricStorePort {
  append(record: AgentMetricRecord): Promise<void>;
  listByUser(userId: string, filter?: AgentMetricFilter): Promise<readonly AgentMetricRecord[]>;
}
