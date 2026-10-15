import { z } from 'zod';
import { InvalidInputError } from '../shared/invalid.input.error.ts';

/** Valida `raw` com `schema` na fronteira dos casos de uso de notificacao; `InvalidInputError` se falhar. */
export function parseUserNotificationInput<S extends z.ZodType>(schema: S, raw: unknown, context: string): z.infer<S> {
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const flat = z.flattenError(parsed.error);
    throw new InvalidInputError(context, flat.fieldErrors as Record<string, string[]>, flat.formErrors);
  }
  return parsed.data;
}
