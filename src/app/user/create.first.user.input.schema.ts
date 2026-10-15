import { z } from 'zod';
import { createUserInputSchema } from './create.user.input.schema.ts';

/**
 * Entrada do "primeiro acesso" (spec 002, design.md 6.3): o cadastro da 001
 * (`createUserInputSchema`) + uma senha opcional. Quando `password` vem, o usuario ja nasce
 * com a senha e a chave de recuperacao gravadas na MESMA transacao (`CreateFirstUserUseCase`)
 * - nunca fica um usuario meio-criado.
 */
export const createFirstUserInputSchema = createUserInputSchema.extend({
  password: z
    .string()
    .min(4, 'a senha precisa de ao menos 4 caracteres')
    .max(128, 'senha muito longa')
    .optional(),
});

/** Entrada ja validada de `CreateFirstUserUseCase`. */
export type CreateFirstUserInput = z.infer<typeof createFirstUserInputSchema>;
