import { z } from 'zod';

/**
 * Schema da entrada externa de "atualizar transferencia" (spec 016, decisao do usuario). So
 * metadados compartilhados (data, notas) - `amountCents`/contas propositalmente ausentes:
 * mudar valor ou contas exige excluir e recriar atomicamente, nunca um update parcial que
 * poderia deixar as duas pernas divergentes (ver `TransferAmountChangeNotAllowedError`).
 */
export const updateTransferInputSchema = z.object({
  userId: z.string().trim().min(1, 'userId obrigatorio'),
  transactionId: z.string().trim().min(1, 'transactionId obrigatorio'),
  date: z.iso.datetime({ offset: true }).or(z.iso.date()).optional(),
  notes: z.string().trim().max(500, 'notes muito longa').optional(),
});

/** Entrada ja validada de `UpdateTransferUseCase`. */
export type UpdateTransferInput = z.infer<typeof updateTransferInputSchema>;
