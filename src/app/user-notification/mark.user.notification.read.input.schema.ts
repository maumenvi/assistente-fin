import { z } from 'zod';

/** Entrada de "marcar notificacao como lida" (spec 013, RF-7). */
export const markUserNotificationReadInputSchema = z.object({
  userId: z.string().trim().min(1, 'userId obrigatorio'),
  id: z.string().trim().min(1, 'id obrigatorio'),
});
