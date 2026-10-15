import { z } from 'zod';

/** Entrada de "emitir notificacao" (spec 013, RF-5, RF-9). Limites espelham as invariantes do dominio. */
export const emitUserNotificationInputSchema = z.object({
  userId: z.string().trim().min(1, 'userId obrigatorio'),
  source: z.string().regex(/^[a-z][a-z0-9-]{0,39}$/, 'origem invalida'),
  message: z.string().trim().min(1, 'mensagem obrigatoria').max(500, 'mensagem com no maximo 500 caracteres'),
  title: z.string().trim().min(1, 'titulo vazio').max(100, 'titulo com no maximo 100 caracteres').optional(),
});
