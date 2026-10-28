import { z } from 'zod';
import { InvalidInputError } from '../../../shared/invalid.input.error.ts';

/** Valida a entrada na fronteira do caso de uso; devolve os dados ou lanca `InvalidInputError`. */
export function parsePreferenceInput<T extends z.ZodType>(schema: T, rawInput: unknown, operation: string): z.infer<T> {
  const parsed = schema.safeParse(rawInput);
  if (!parsed.success) {
    const flat = z.flattenError(parsed.error);
    throw new InvalidInputError(operation, flat.fieldErrors as Record<string, string[]>, flat.formErrors);
  }
  return parsed.data;
}
