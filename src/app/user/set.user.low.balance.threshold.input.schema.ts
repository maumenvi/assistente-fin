import { z } from 'zod';

/**
 * Schema da entrada externa de "definir limite de saldo baixo do Dashboard" (spec 015, RF-2).
 * `thresholdCents` nulo volta ao padrao do sistema (R$ 400,00, resolvido na leitura).
 */
export const setUserLowBalanceThresholdInputSchema = z.object({
  userId: z.string().trim().min(1, 'userId obrigatorio'),
  thresholdCents: z.number().int().nonnegative('thresholdCents nao pode ser negativo').nullable(),
});

/** Entrada ja validada de `SetUserLowBalanceThresholdUseCase`. */
export type SetUserLowBalanceThresholdInput = z.infer<typeof setUserLowBalanceThresholdInputSchema>;
