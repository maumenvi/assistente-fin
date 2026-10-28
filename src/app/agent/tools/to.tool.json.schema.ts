import { z, type ZodType } from 'zod';
import { type JsonSchema } from '../ports/llm/json.schema.ts';

/** Gera o JSON Schema (Zod 4) enviado ao modelo, sem o `$schema`, que alguns provedores recusam. */
export function toToolJsonSchema(schema: ZodType): JsonSchema {
  const { $schema: _ignored, ...rest } = z.toJSONSchema(schema, { io: 'input' }) as Record<string, unknown>;
  return rest;
}
