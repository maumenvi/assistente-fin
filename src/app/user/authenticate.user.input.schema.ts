import { z } from 'zod';

/**
 * Schema da entrada externa de "autenticar usuario" (spec 002, RF-8, RF-12).
 *
 * `password` opcional: um usuario sem senha (`hasPassword() === false`) entra so com o
 * `userId` escolhido na tela de selecao.
 */
export const authenticateUserInputSchema = z.object({
  userId: z.string().trim().min(1, 'userId obrigatorio'),
  password: z.string().min(1).optional(),
});

/** Entrada ja validada de `AuthenticateUserUseCase`. */
export type AuthenticateUserInput = z.infer<typeof authenticateUserInputSchema>;
