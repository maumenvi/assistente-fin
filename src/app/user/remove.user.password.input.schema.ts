import { z } from 'zod';

/** Schema da entrada externa de "remover senha" (spec 002, RF-9, RF-12). */
export const removeUserPasswordInputSchema = z.object({
  userId: z.string().trim().min(1, 'userId obrigatorio'),
});

/** Entrada ja validada de `RemoveUserPasswordUseCase`. */
export type RemoveUserPasswordInput = z.infer<typeof removeUserPasswordInputSchema>;
