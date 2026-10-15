import { z } from 'zod';

/** Schema da entrada externa de "cancelar parcelas restantes" (spec 009, RF-8). */
export const cancelRemainingInstallmentsInputSchema = z.object({
  userId: z.string().trim().min(1, 'userId obrigatorio'),
  transactionId: z.string().trim().min(1, 'transactionId obrigatorio'),
});

/** Entrada ja validada de `CancelRemainingInstallmentsUseCase`. */
export type CancelRemainingInstallmentsInput = z.infer<typeof cancelRemainingInstallmentsInputSchema>;
