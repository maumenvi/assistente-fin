import { z } from 'zod';
import { VERIFICATION_CHANNELS } from '../../domain/verification/verification.channel.ts';

/** Schema da entrada externa de "confirmar verificacao" (spec 001, RF-26, RF-12). */
export const confirmVerificationInputSchema = z.object({
  userId: z.string().trim().min(1, 'userId obrigatorio'),
  channel: z.enum(VERIFICATION_CHANNELS),
  code: z.string().trim().min(1, 'codigo obrigatorio'),
});

/** Entrada ja validada de `ConfirmVerificationUseCase`. */
export type ConfirmVerificationInput = z.infer<typeof confirmVerificationInputSchema>;
