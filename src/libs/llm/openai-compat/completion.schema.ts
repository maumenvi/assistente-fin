import { z } from 'zod';

/** Resposta nao-streaming de `POST /chat/completions` (usada pela sonda de ferramentas). */
export const completionSchema = z.object({
  choices: z
    .array(
      z.object({
        message: z
          .object({
            content: z.string().nullish(),
            tool_calls: z
              .array(
                z.object({
                  id: z.string().nullish(),
                  function: z.object({ name: z.string().nullish(), arguments: z.string().nullish() }).nullish(),
                }),
              )
              .nullish(),
          })
          .nullish(),
      }),
    )
    .nullish(),
});
