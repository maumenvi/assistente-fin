import { z } from 'zod';

/**
 * Resultado do reconhecimento de fala na fronteira (spec 022, T099; constitution III): so
 * aceita uma transcricao de texto nao vazia e de tamanho razoavel antes de ir ao parser.
 */
export const speechResultSchema = z.object({
  transcript: z.string().trim().min(1, 'nada foi reconhecido').max(500, 'fala longa demais'),
  confidence: z.number().min(-1).max(1).optional(),
});

export type SpeechResult = z.infer<typeof speechResultSchema>;
