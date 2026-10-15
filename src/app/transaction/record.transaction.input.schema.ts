import { z } from 'zod';
import { categorySelectionSchema } from '../shared/category.selection.schema.ts';
import { recurrenceInputSchema } from '../shared/recurrence.input.schema.ts';
import { TRANSACTION_TYPES } from '../../domain/transaction/transaction.type.ts';

/**
 * Schema da entrada externa de "registrar transacao" (spec 001, RF-5, RF-12).
 *
 * A categoria e opcional: ausente => o app vincula a categoria padrao, o que deixa a
 * transacao pendente de classificacao (spec 003, RF-14, CA-7), nunca erro de validacao.
 *
 * `recurrence` tambem e opcional: ausente ou `nao-repete` => um unico lancamento. Repetindo,
 * o caso de uso cria uma `TransactionSeries` e materializa as ocorrencias (RF-25). O cadastro
 * de novos lancamentos manda sempre `everyN: 1` (presets); valores maiores so vem de backup.
 */
export const recordTransactionInputSchema = z.object({
  userId: z.string().trim().min(1, 'userId obrigatorio'),
  date: z.iso.datetime({ offset: true }).or(z.iso.date()),
  amountCents: z.int('valor deve ser inteiro em centavos').positive('valor deve ser positivo'),
  type: z.enum(TRANSACTION_TYPES),
  ...categorySelectionSchema,
  recurrence: recurrenceInputSchema.optional(),
  accountId: z.string().trim().min(1, 'accountId obrigatorio'),
  notes: z.string().trim().max(500, 'notes muito longa').optional(),
});

/** Entrada ja validada de `RecordTransactionUseCase`. */
export type RecordTransactionInput = z.infer<typeof recordTransactionInputSchema>;
