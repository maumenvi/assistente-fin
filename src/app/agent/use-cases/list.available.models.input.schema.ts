import { z } from 'zod';

/** Entrada de "modelos disponiveis": o perfil ja salvo (a chave vem do cofre). */
export const listAvailableModelsInputSchema = z.object({
  userId: z.string().trim().min(1, 'userId obrigatorio'),
  profileId: z.string().trim().min(1, 'profileId obrigatorio').max(100),
});
