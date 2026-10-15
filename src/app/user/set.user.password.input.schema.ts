import { z } from 'zod';

/**
 * Schema da entrada externa de "definir senha" (spec 002, RF-9, RF-12).
 *
 * Minimo de 4 caracteres, sem regras de complexidade (decisao do usuario).
 */
export const setUserPasswordInputSchema = z.object({
  userId: z.string().trim().min(1, 'userId obrigatorio'),
  password: z.string().min(4, 'a senha precisa de ao menos 4 caracteres').max(128, 'senha muito longa'),
});

/** Entrada ja validada de `SetUserPasswordUseCase`. */
export type SetUserPasswordInput = z.infer<typeof setUserPasswordInputSchema>;
