import { z } from 'zod';
import { categorySelectionSchema } from '../shared/category.selection.schema.ts';
import { TRANSACTION_TYPES } from '../../domain/transaction/transaction.type.ts';

/**
 * Schema da entrada externa de "atualizar transacao" (spec 002, RF-20, RF-31).
 *
 * Campos de mudanca opcionais. Categoria ausente = nao mexe na que ja esta la (spec 003:
 * nao ha mais "voltar pra pendente" - para isso, aponte para a categoria padrao).
 * `accountId` (opcional, spec 005, RF-7/RF-8) permite mover o lancamento de conta; a
 * validacao de existencia/posse/arquivamento acontece no use case. `expectedUpdatedAt`
 * (opcional) aplica a trava otimista.
 */
export const updateTransactionInputSchema = z.object({
  id: z.string().trim().min(1, 'id obrigatorio'),
  userId: z.string().trim().min(1, 'userId obrigatorio'),
  expectedUpdatedAt: z.iso.datetime({ offset: true }).optional(),
  date: z.iso.datetime({ offset: true }).or(z.iso.date()).optional(),
  amountCents: z.int('valor deve ser inteiro em centavos').positive('valor deve ser positivo').optional(),
  type: z.enum(TRANSACTION_TYPES).optional(),
  accountId: z.string().trim().min(1, 'accountId obrigatorio').optional(),
  ...categorySelectionSchema,
  notes: z.string().trim().max(500, 'notes muito longa').optional(),
});

/** Entrada ja validada de `UpdateTransactionUseCase`. */
export type UpdateTransactionInput = z.infer<typeof updateTransactionInputSchema>;
