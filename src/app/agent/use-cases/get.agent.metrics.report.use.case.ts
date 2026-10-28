import { type AgentMetricsReport } from '../../../domain/agent/metrics/agent.metrics.report.ts';
import { buildAgentMetricsReport } from '../../../domain/agent/metrics/build.agent.metrics.report.ts';
import { type AgentStorePort } from '../ports/store/agent.store.port.ts';
import {
  getAgentMetricsReportInputSchema,
  type GetAgentMetricsReportInput,
} from './get.agent.metrics.report.input.schema.ts';

/**
 * Consulta os registros permanentes de metricas de LLM do usuario e devolve o
 * relatorio consolidado com grafico de barras por LLM e eficacia por estrategia (spec 038, FR-003, FR-020).
 */
export class GetAgentMetricsReportUseCase {
  readonly #store: AgentStorePort;

  constructor(deps: { readonly store: AgentStorePort }) {
    this.#store = deps.store;
  }

  async execute(raw: GetAgentMetricsReportInput): Promise<AgentMetricsReport> {
    const input = getAgentMetricsReportInputSchema.parse(raw);
    const records = await this.#store.metrics.listByUser(input.userId, {
      ...(input.fromIso !== undefined ? { fromIso: input.fromIso } : {}),
      ...(input.toIso !== undefined ? { toIso: input.toIso } : {}),
      ...(input.strategy !== undefined ? { strategy: input.strategy } : {}),
      ...(input.model !== undefined ? { model: input.model } : {}),
      ...(input.conversationId !== undefined ? { conversationId: input.conversationId } : {}),
    });
    return buildAgentMetricsReport(records);
  }
}

