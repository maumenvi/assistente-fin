import { z } from 'zod';
import { providerErrorSchema } from './provider.error.schema.ts';
import { toolCallDeltaSchema } from './tool.call.delta.schema.ts';
import { usageSchema } from './usage.schema.ts';

/** Um `chat.completion.chunk` do stream. Tolerante: campos extras sao ignorados. */
export const chunkSchema = z.object({
  choices: z
    .array(
      z.object({
        delta: z
          .object({
            content: z.union([z.string(), z.array(z.unknown())]).nullish(),
            reasoning: z.string().nullish(),
            reasoning_content: z.string().nullish(),
            reasoning_details: z.array(z.unknown()).nullish(),
            tool_calls: z.array(toolCallDeltaSchema).nullish(),
          })
          .nullish(),
        finish_reason: z.string().nullish(),
      }),
    )
    .nullish(),
  usage: usageSchema.nullish(),
  error: providerErrorSchema.nullish(),
});

/** Chunk ja validado. */
export type StreamChunk = z.infer<typeof chunkSchema>;
