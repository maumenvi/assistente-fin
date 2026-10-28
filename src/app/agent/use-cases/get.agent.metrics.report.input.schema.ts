import { z } from 'zod';
import { ROUTING_STRATEGIES } from '../../../domain/agent/routing/routing.strategy.ts';

/** Entrada de consulta do relatorio consolidado de metricas (spec 038, contracts/ipc.metrics.and.execution.md). */
export const getAgentMetricsReportInputSchema = z.object({
  userId: z.string().trim().min(1, 'userId obrigatorio'),
  fromIso: z.string().trim().min(1).optional(),
  toIso: z.string().trim().min(1).optional(),
  strategy: z.enum(ROUTING_STRATEGIES).optional(),
  model: z.string().trim().min(1).max(200).optional(),
  conversationId: z.string().trim().min(1).optional(),
});

export type GetAgentMetricsReportInput = z.infer<typeof getAgentMetricsReportInputSchema>;

