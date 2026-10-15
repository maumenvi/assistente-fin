import { z } from 'zod';

/** Schema da entrada externa de "redefinir acesso localmente" (spec 002, RF-9e, RF-12). */
export const clearUserCredentialsInputSchema = z.object({
  userId: z.string().trim().min(1, 'userId obrigatorio'),
  confirmationCpf: z.string().trim().min(1, 'CPF de confirmacao obrigatorio'),
});

/** Entrada ja validada de `ClearUserCredentialsUseCase`. */
export type ClearUserCredentialsInput = z.infer<typeof clearUserCredentialsInputSchema>;
