import { z } from 'zod';

/** Schema da entrada externa de "redefinir senha com a chave de recuperacao" (spec 002, RF-9b/RF-9c). */
export const resetPasswordWithRecoveryKeyInputSchema = z.object({
  userId: z.string().trim().min(1, 'userId obrigatorio'),
  recoveryKey: z.string().trim().min(1, 'chave de recuperacao obrigatoria'),
  newPassword: z
    .string()
    .min(4, 'a nova senha precisa de ao menos 4 caracteres')
    .max(128, 'senha muito longa'),
});

/** Entrada ja validada de `ResetPasswordWithRecoveryKeyUseCase`. */
export type ResetPasswordWithRecoveryKeyInput = z.infer<
  typeof resetPasswordWithRecoveryKeyInputSchema
>;
