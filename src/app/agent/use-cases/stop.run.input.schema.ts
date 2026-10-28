import { z } from 'zod';

/** Entrada de "parar execucao". */
export const stopRunInputSchema = z.object({
  userId: z.string().trim().min(1, 'userId obrigatorio'),
  runId: z.string().trim().min(1, 'runId obrigatorio').max(100),
});
