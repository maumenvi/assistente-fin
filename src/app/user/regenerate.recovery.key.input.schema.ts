import { z } from 'zod';

/** Schema da entrada externa de "gerar nova chave de recuperacao" (spec 002, RF-9d, RF-12). */
export const regenerateRecoveryKeyInputSchema = z.object({
  userId: z.string().trim().min(1, 'userId obrigatorio'),
  currentPassword: z.string().min(1, 'senha atual obrigatoria'),
});

/** Entrada ja validada de `RegenerateRecoveryKeyUseCase`. */
export type RegenerateRecoveryKeyInput = z.infer<typeof regenerateRecoveryKeyInputSchema>;
