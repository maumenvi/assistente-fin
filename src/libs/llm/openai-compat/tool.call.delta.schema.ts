import { z } from 'zod';

/** Fragmento de uma chamada de ferramenta num chunk de streaming (formato chat completions). */
export const toolCallDeltaSchema = z.object({
  index: z.number().int().nullish(),
  id: z.string().nullish(),
  type: z.string().nullish(),
  /** Extra do provedor (Google: `{ google: { thought_signature } }`); precisa voltar junto da chamada no turno seguinte. */
  extra_content: z.unknown().optional(),
  function: z
    .object({
      name: z.string().nullish(),
      arguments: z.string().nullish(),
    })
    .nullish(),
});

/** Fragmento de chamada de ferramenta ja validado. */
export type ToolCallDelta = z.infer<typeof toolCallDeltaSchema>;
