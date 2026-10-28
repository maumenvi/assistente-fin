import { z } from 'zod';

/** Tamanho maximo de uma pergunta, em caracteres (depois do `trim`). */
export const MAX_MESSAGE_CHARS = 4000;

/** Entrada externa de "enviar mensagem ao agente": texto de 1 a 4000 caracteres e conversa opcional. */
export const sendMessageInputSchema = z.object({
  userId: z.string().trim().min(1, 'userId obrigatorio'),
  conversationId: z.string().trim().min(1).max(100).optional(),
  /** Rascunhos de anexo a enviar junto (spec 036): ate 5. */
  attachmentIds: z.array(z.string().trim().min(1).max(100)).max(5, 'no maximo 5 anexos por mensagem').optional(),
  text: z.string().trim().min(1, 'escreva uma mensagem').max(MAX_MESSAGE_CHARS, `a mensagem pode ter no maximo ${MAX_MESSAGE_CHARS} caracteres`),
});

/** Entrada ja validada. */
export type SendMessageInput = z.infer<typeof sendMessageInputSchema>;
