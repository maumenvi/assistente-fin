import { z } from 'zod';

/** Schema da entrada externa de "trocar senha" (spec 002, RF-9a, RF-12). */
export const changeUserPasswordInputSchema = z.object({
  userId: z.string().trim().min(1, 'userId obrigatorio'),
  currentPassword: z.string().min(1, 'senha atual obrigatoria'),
  newPassword: z
    .string()
    .min(4, 'a nova senha precisa de ao menos 4 caracteres')
    .max(128, 'senha muito longa'),
});

/** Entrada ja validada de `ChangeUserPasswordUseCase`. */
export type ChangeUserPasswordInput = z.infer<typeof changeUserPasswordInputSchema>;
