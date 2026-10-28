import { z } from 'zod';
import { pageLimitSchema } from './page.limit.schema.ts';

/** Entrada de "mensagens de uma conversa": 50 por pagina, voltando no tempo por `beforeSeq`. */
export const getConversationMessagesInputSchema = z.object({
  userId: z.string().trim().min(1, 'userId obrigatorio'),
  conversationId: z.string().trim().min(1, 'conversationId obrigatorio'),
  limit: pageLimitSchema,
  beforeSeq: z.int().min(1).optional(),
});
