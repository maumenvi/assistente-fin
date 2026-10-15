import { z } from 'zod';
import { VERIFICATION_CHANNELS } from '../../domain/verification/verification.channel.ts';

/** Schema da entrada externa de "solicitar verificacao" (spec 001, RF-24, RF-12). */
export const requestVerificationInputSchema = z.object({
  userId: z.string().trim().min(1, 'userId obrigatorio'),
  channel: z.enum(VERIFICATION_CHANNELS),
});

/** Entrada ja validada de `RequestVerificationUseCase`. */
export type RequestVerificationInput = z.infer<typeof requestVerificationInputSchema>;
