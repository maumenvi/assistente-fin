import { z } from 'zod';

/** Schema da entrada externa de "calcular limite disponivel de cartao de credito" (spec 008, RF-7). */
export const calculateCreditCardAvailableLimitInputSchema = z.object({
  userId: z.string().trim().min(1, 'userId obrigatorio'),
  accountId: z.string().trim().min(1, 'accountId obrigatorio'),
});

/** Entrada ja validada e normalizada de `CalculateCreditCardAvailableLimitUseCase`. */
export type CalculateCreditCardAvailableLimitInput = z.infer<
  typeof calculateCreditCardAvailableLimitInputSchema
>;
