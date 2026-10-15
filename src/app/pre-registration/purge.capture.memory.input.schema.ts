import { z } from 'zod';

/** Entrada da limpeza da memoria de capturas (spec 027). */
export const purgeCaptureMemoryInputSchema = z.object({
  userId: z.string().trim().min(1, 'userId obrigatorio'),
});
