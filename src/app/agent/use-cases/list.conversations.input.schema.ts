import { z } from 'zod';
import { pageLimitSchema } from './page.limit.schema.ts';

/** Entrada de "listar conversas": mais recentes primeiro, paginado por `lastMessageAt`. */
export const listConversationsInputSchema = z.object({
  userId: z.string().trim().min(1, 'userId obrigatorio'),
  limit: pageLimitSchema,
  before: z.string().trim().min(1).optional(),
});
