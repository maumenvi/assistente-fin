import { z } from 'zod';

/** Schema da entrada externa de "prolongar serie" (spec 003, RF-21). */
export const extendTransactionSeriesInputSchema = z.object({
  userId: z.string().trim().min(1, 'userId obrigatorio'),
  seriesId: z.string().trim().min(1, 'seriesId obrigatorio'),
});

/** Entrada ja validada de `ExtendTransactionSeriesUseCase`. */
export type ExtendTransactionSeriesInput = z.infer<typeof extendTransactionSeriesInputSchema>;
