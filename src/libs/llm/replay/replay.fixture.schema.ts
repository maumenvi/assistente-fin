import { z } from 'zod';

const eventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('text_delta'), text: z.string() }),
  z.object({ type: z.literal('reasoning_delta'), text: z.string() }),
  z.object({
    type: z.literal('tool_call'),
    id: z.string(),
    name: z.string(),
    args: z.unknown(),
    argsError: z.string().optional(),
  }),
  z.object({ type: z.literal('provider_state'), state: z.unknown() }),
  z.object({
    type: z.literal('usage'),
    inputTokens: z.number(),
    outputTokens: z.number(),
    cachedTokens: z.number().optional(),
    costMicroUsd: z.number().optional(),
  }),
  z.object({ type: z.literal('finish'), reason: z.enum(['stop', 'tool_calls', 'length', 'content_filter']) }),
]);

const errorSchema = z.object({
  code: z.enum(['LLM_UNAVAILABLE', 'LLM_AUTH', 'LLM_KEY_EXPIRED', 'LLM_RATE_LIMITED', 'LLM_QUOTA', 'LLM_MODEL_NOT_FOUND', 'LLM_PROTOCOL', 'LLM_PROTOCOL_CHUNK', 'LLM_PROTOCOL_END', 'LLM_PROTOCOL_EMPTY']),
  message: z.string().optional(),
  retryAfterMs: z.number().optional(),
  emittedContent: z.boolean().optional(),
});

/** Formato das fixtures de resposta gravada (`tests/fixtures/agent/<modelo>/<cenario>.json`). */
export const replayFixtureSchema = z.object({
  version: z.literal(1),
  turns: z
    .array(z.object({ events: z.array(eventSchema), delayMs: z.number().int().nonnegative().optional(), error: errorSchema.optional() }))
    .min(1),
});

/** Fixture ja validada. */
export type ReplayFixture = z.infer<typeof replayFixtureSchema>;
