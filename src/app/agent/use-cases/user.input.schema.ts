import { z } from 'zod';

/** Entrada que so identifica o usuario (nova conversa, apagar tudo). */
export const userInputSchema = z.object({ userId: z.string().trim().min(1, 'userId obrigatorio') });
