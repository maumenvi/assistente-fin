import { z } from 'zod';

/** Entrada de "listar pre-registros". */
export const listPreRegistrationsInputSchema = z.object({
  userId: z.string().trim().min(1, 'userId obrigatorio'),
});
