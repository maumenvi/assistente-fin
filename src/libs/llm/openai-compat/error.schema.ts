import { z } from 'zod';
import { providerErrorSchema } from './provider.error.schema.ts';

/** Corpo de erro HTTP: `{ "error": { "code", "message" } }`. */
export const errorBodySchema = z.object({
  error: providerErrorSchema,
});
