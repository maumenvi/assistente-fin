import { z } from 'zod';

/** Entrada de "listar notificacoes" (spec 013, RF-7a): paginada, `pageSize` ate 100. */
export const listUserNotificationsInputSchema = z.object({
  userId: z.string().trim().min(1, 'userId obrigatorio'),
  page: z.int().min(1).default(1),
  pageSize: z.int().min(1).max(100).default(20),
  unreadOnly: z.boolean().default(false),
});
