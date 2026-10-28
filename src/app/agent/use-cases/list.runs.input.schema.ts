import { z } from 'zod';
import { RUN_STATUSES } from '../../../domain/agent/run.status.ts';

/** Entrada de "listar execucoes": filtros de status e modelo, 50 por pagina, cursor por `startedAt`. */
export const listRunsInputSchema = z.object({
  userId: z.string().trim().min(1, 'userId obrigatorio'),
  status: z.enum(RUN_STATUSES).optional(),
  model: z.string().trim().min(1).max(200).optional(),
  limit: z.int().min(1).max(50).default(50),
  before: z.string().trim().min(1).max(64).optional(),
});
