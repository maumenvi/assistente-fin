import { z } from 'zod';
import { CAPTURE_ATTACHMENT_KINDS } from '../../domain/pre-registration/capture.attachment.kind.ts';
import { captureDraftSchema } from './capture.draft.schema.ts';

/** Entrada de "criar pre-registro a partir de uma captura" (spec 022, T091). */
export const createPreRegistrationFromCaptureInputSchema = z.object({
  userId: z.string().trim().min(1, 'userId obrigatorio'),
  draft: captureDraftSchema,
  attachments: z
    .array(
      z.object({
        kind: z.enum(CAPTURE_ATTACHMENT_KINDS),
        mimeType: z.string().trim().min(1).optional(),
        content: z.string().max(20_000).optional(),
        fileRef: z.string().trim().min(1).optional(),
        sha256: z.string().regex(/^[0-9a-f]{64}$/),
      }),
    )
    .default([]),
  sourceDevice: z.string().trim().min(1).max(60).optional(),
});
