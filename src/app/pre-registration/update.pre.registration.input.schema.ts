import { z } from 'zod';
import { preRegistrationFieldsSchema } from './pre.registration.fields.schema.ts';

/** Entrada de "editar pre-registro" (spec 022, FR-023). */
export const updatePreRegistrationInputSchema = z.object({
  userId: z.string().trim().min(1, 'userId obrigatorio'),
  id: z.string().trim().min(1, 'id obrigatorio'),
  expectedUpdatedAt: z.iso.datetime({ offset: true }).optional(),
  ...preRegistrationFieldsSchema,
  needsReview: z.boolean().optional(),
});

export type UpdatePreRegistrationInput = z.infer<typeof updatePreRegistrationInputSchema>;
