import { z } from 'zod';

/**
 * Schema da entrada externa de "definir conta padrao para lancamentos" (spec 007, RF-3, RF-4).
 * `accountId` nulo limpa a preferencia; string vazia nao e aceita (usar `null` para limpar).
 */
export const setUserDefaultAccountInputSchema = z.object({
  userId: z.string().trim().min(1, 'userId obrigatorio'),
  accountId: z.string().trim().min(1, 'accountId nao pode ser vazio').nullable(),
});

/** Entrada ja validada de `SetUserDefaultAccountUseCase`. */
export type SetUserDefaultAccountInput = z.infer<typeof setUserDefaultAccountInputSchema>;
