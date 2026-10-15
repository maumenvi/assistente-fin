import { z } from 'zod';

/**
 * Schema da entrada externa de "atualizar pagamento de fatura" (spec 016, decisao do
 * usuario). So metadados compartilhados (data, notas) - mesma restricao de
 * `updateTransferInputSchema`: mudar valor ou contas exige excluir e recriar atomicamente.
 */
export const updateCardPaymentInputSchema = z.object({
  userId: z.string().trim().min(1, 'userId obrigatorio'),
  transactionId: z.string().trim().min(1, 'transactionId obrigatorio'),
  date: z.iso.datetime({ offset: true }).or(z.iso.date()).optional(),
  notes: z.string().trim().max(500, 'notes muito longa').optional(),
});

/** Entrada ja validada de `UpdateCardPaymentUseCase`. */
export type UpdateCardPaymentInput = z.infer<typeof updateCardPaymentInputSchema>;
