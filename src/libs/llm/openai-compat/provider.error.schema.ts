import { z } from 'zod';

/** Objeto de erro do provedor (`{ code, message }`), no corpo de uma resposta HTTP ou dentro de um chunk. */
export const providerErrorSchema = z.object({
  code: z.union([z.string(), z.number()]).nullish(),
  message: z.string().nullish(),
  type: z.string().nullish(),
});

/** Erro do provedor ja validado. */
export type ProviderError = z.infer<typeof providerErrorSchema>;
