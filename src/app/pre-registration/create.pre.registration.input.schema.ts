import { z } from 'zod';
import { PRE_REGISTRATION_ORIGINS } from '../../domain/pre-registration/pre.registration.origin.ts';
import { preRegistrationFieldsSchema } from './pre.registration.fields.schema.ts';

/** Entrada de "criar pre-registro" (spec 022, FR-021/FR-022). */
export const createPreRegistrationInputSchema = z.object({
  userId: z.string().trim().min(1, 'userId obrigatorio'),
  origin: z.enum(PRE_REGISTRATION_ORIGINS).default('manual'),
  ...preRegistrationFieldsSchema,
  needsReview: z.boolean().optional(),
  manualOnly: z.boolean().optional(),
  dedupKey: z.string().trim().min(1).max(200).optional(),
  /** Link da NFC-e, para achar a nota ja registrada (FR-027). */
  link: z.string().trim().min(1).max(500).optional(),
  sourceDevice: z.string().trim().min(1).max(60).optional(),
});

export type CreatePreRegistrationInput = z.infer<typeof createPreRegistrationInputSchema>;
