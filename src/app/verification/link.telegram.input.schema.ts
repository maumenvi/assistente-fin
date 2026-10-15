import { z } from 'zod';

/** Entrada de "vincular Telegram" (spec 002, Fase 8.5-T4). O `chatId` vem do `getUpdates`. */
export const linkTelegramInputSchema = z.object({
  userId: z.string().trim().min(1, 'userId obrigatorio'),
  chatId: z.string().trim().min(1, 'chatId obrigatorio'),
});

/** Entrada ja validada de `LinkTelegramUseCase`. */
export type LinkTelegramInput = z.infer<typeof linkTelegramInputSchema>;
