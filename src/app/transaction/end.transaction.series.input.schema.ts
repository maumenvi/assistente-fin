import { z } from 'zod';

/** Schema da entrada externa de "encerrar serie a partir de uma ocorrencia" (spec 003, RF-29). */
export const endTransactionSeriesInputSchema = z.object({
  userId: z.string().trim().min(1, 'userId obrigatorio'),
  seriesId: z.string().trim().min(1, 'seriesId obrigatorio'),
  /** A ocorrencia a partir da qual a serie encerra - ela mesma e as anteriores ficam. */
  fromTransactionId: z.string().trim().min(1, 'fromTransactionId obrigatorio'),
});

/** Entrada ja validada de `EndTransactionSeriesUseCase`. */
export type EndTransactionSeriesInput = z.infer<typeof endTransactionSeriesInputSchema>;
