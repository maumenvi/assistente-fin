import { z } from 'zod';

/** Entrada com dono + id de um pre-registro (descartar). */
export const preRegistrationIdInputSchema = z.object({
  userId: z.string().trim().min(1, 'userId obrigatorio'),
  id: z.string().trim().min(1, 'id obrigatorio'),
});
