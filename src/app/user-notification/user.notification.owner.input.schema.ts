import { z } from 'zod';

/** Entrada que so identifica o dono das notificacoes (contagem de nao lidas, spec 013 RF-13a). */
export const userNotificationOwnerInputSchema = z.object({
  userId: z.string().trim().min(1, 'userId obrigatorio'),
});
