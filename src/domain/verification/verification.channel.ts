/**
 * Canal de verificacao de contato do usuario (spec 001, RF-23..RF-27).
 *
 * - `email`  confirmado via `EmailSender`
 * - `phone`  confirmado via `SmsSender`
 */
export const VERIFICATION_CHANNELS = ['email', 'phone'] as const;

/** Um dos valores de `VERIFICATION_CHANNELS`. */
export type VerificationChannel = (typeof VERIFICATION_CHANNELS)[number];
