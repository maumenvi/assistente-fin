import { z } from 'zod';

/** Registro de consentimento de nuvem, validado ao ser lido do disco. */
export const consentRecordSchema = z.object({
  kind: z.enum(['cloud', 'attachments']),
  acceptedAt: z.string().min(1),
  textVersion: z.string().min(1),
});
