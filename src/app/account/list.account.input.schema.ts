import { z } from 'zod';

/** Schema da entrada externa de "listar contas" (spec 001, RF-1, RF-12). */
export const listAccountInputSchema = z.object({
  userId: z.string().trim().min(1, 'userId obrigatorio'),
});

/** Entrada ja validada de `ListAccountsUseCase`. */
export type ListAccountInput = z.infer<typeof listAccountInputSchema>;
