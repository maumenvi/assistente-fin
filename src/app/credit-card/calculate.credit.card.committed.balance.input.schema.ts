import { z } from 'zod';

/** Schema da entrada externa de "calcular saldo comprometido de cartao de credito" (spec 014, RF-1). */
export const calculateCreditCardCommittedBalanceInputSchema = z.object({
  userId: z.string().trim().min(1, 'userId obrigatorio'),
  accountId: z.string().trim().min(1, 'accountId obrigatorio'),
});

/** Entrada ja validada e normalizada de `CalculateCreditCardCommittedBalanceUseCase`. */
export type CalculateCreditCardCommittedBalanceInput = z.infer<
  typeof calculateCreditCardCommittedBalanceInputSchema
>;
