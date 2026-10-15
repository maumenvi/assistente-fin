import { z } from 'zod';

/**
 * Resultado do OCR do aparelho (ML Kit) validado na fronteira (spec 022, T126; constitution III)
 * antes de ir ao `parseReceiptText`.
 */
export const ocrResultSchema = z.object({
  text: z.string().max(20_000),
  blocks: z.array(z.object({ text: z.string() }).loose()).optional(),
});

export type OcrResult = z.infer<typeof ocrResultSchema>;
