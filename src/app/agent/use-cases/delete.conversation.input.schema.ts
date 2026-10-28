import { z } from 'zod';

/** Entrada de "apagar conversa". */
export const deleteConversationInputSchema = z.object({
  userId: z.string().trim().min(1, 'userId obrigatorio'),
  conversationId: z.string().trim().min(1, 'conversationId obrigatorio'),
});
