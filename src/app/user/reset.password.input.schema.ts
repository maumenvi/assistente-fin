import { z } from 'zod';
import { VERIFICATION_CHANNELS } from '../../domain/verification/verification.channel.ts';

/** Schema da entrada externa de "redefinir senha por codigo" (spec 002, RF-9b, RF-12). */
export const resetPasswordInputSchema = z.object({
  userId: z.string().trim().min(1, 'userId obrigatorio'),
  channel: z.enum(VERIFICATION_CHANNELS),
  code: z.string().trim().min(1, 'codigo obrigatorio'),
  newPassword: z
    .string()
    .min(4, 'a nova senha precisa de ao menos 4 caracteres')
    .max(128, 'senha muito longa'),
});

/** Entrada ja validada de `ResetPasswordUseCase`. */
export type ResetPasswordInput = z.infer<typeof resetPasswordInputSchema>;
