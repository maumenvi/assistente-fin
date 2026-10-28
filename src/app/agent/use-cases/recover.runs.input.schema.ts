import { z } from 'zod';

/** Entrada de "recuperar execucoes": o usuario cuja sessao acabou de abrir. */
export const recoverRunsInputSchema = z.object({ userId: z.string().trim().min(1, 'userId obrigatorio') });
