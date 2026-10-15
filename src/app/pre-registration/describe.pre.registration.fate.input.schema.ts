import { z } from 'zod';

/** Entrada de "o que aconteceu com este pre-registro?" (spec 027). */
export const describePreRegistrationFateInputSchema = z.object({
  userId: z.string().trim().min(1, 'userId obrigatorio'),
  id: z.string().trim().min(1, 'id obrigatorio'),
});
