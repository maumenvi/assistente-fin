import { z } from 'zod';

/** Entrada de "testar conexao": o perfil ja salvo (a chave vem do cofre, nunca da tela). */
export const testConnectionInputSchema = z.object({
  userId: z.string().trim().min(1, 'userId obrigatorio'),
  profileId: z.string().trim().min(1, 'profileId obrigatorio').max(100),
});
