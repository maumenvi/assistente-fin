import { z } from 'zod';

/** Entrada de "reivindicar exibicao" (spec 013, RF-11a): todas as pendentes ou so os `ids`. */
export const claimUserNotificationDeliveryInputSchema = z.object({
  userId: z.string().trim().min(1, 'userId obrigatorio'),
  ids: z.array(z.string().trim().min(1)).optional(),
});
