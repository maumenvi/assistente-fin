import { z } from 'zod';

const priceSchema = z.union([z.string(), z.number()]).nullish();

/** Resposta de `GET /models`: so o que interessa (id, contexto, parametros suportados, preco). */
export const modelsSchema = z.object({
  data: z.array(
    z.object({
      id: z.string(),
      context_length: z.number().nullish(),
      supported_parameters: z.array(z.string()).nullish(),
      architecture: z.object({ input_modalities: z.array(z.string()).nullish() }).nullish(),
      pricing: z.object({ prompt: priceSchema, completion: priceSchema }).nullish(),
    }),
  ),
});

/** Lista de modelos ja validada. */
export type ModelsResponse = z.infer<typeof modelsSchema>;
