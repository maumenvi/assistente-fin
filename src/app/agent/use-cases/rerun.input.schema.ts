import { z } from 'zod';

/** Entrada de "tentar de novo": a conversa e a resposta (interrompida ou com erro) a refazer. */
export const rerunInputSchema = z.object({
  userId: z.string().trim().min(1, 'userId obrigatorio'),
  conversationId: z.string().trim().min(1, 'conversationId obrigatorio').max(100),
  messageId: z.string().trim().min(1, 'messageId obrigatorio').max(100),
  useFallback: z.boolean().default(false),
});
