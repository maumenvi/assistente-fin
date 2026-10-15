import { z } from 'zod';
import { categorySelectionSchema } from '../shared/category.selection.schema.ts';

/**
 * Schema da entrada externa de "registrar compra parcelada" (spec 009, RF-1; spec 016, RF-1 -
 * qualquer `accountId`, nao so cartao de credito).
 *
 * `installments` sem teto superior (decisao 4.5 do plano): so precisa ser inteiro >= 1.
 * `installments === 1` e uma entrada valida (CA-9) - o caso de uso trata como lancamento
 * comum, sem aplicar o mecanismo de agrupamento de parcelas.
 */
export const recordInstallmentPurchaseInputSchema = z.object({
  userId: z.string().trim().min(1, 'userId obrigatorio'),
  accountId: z.string().trim().min(1, 'accountId obrigatorio'),
  amountCents: z.int('amountCents deve ser inteiro').positive('amountCents deve ser positivo'),
  installments: z.int('installments deve ser inteiro').min(1, 'installments deve ser >= 1'),
  date: z.iso.datetime({ offset: true }).or(z.iso.date()),
  ...categorySelectionSchema,
  notes: z.string().trim().max(500, 'notes muito longa').optional(),
});

/** Entrada ja validada de `RecordInstallmentPurchaseUseCase`. */
export type RecordInstallmentPurchaseInput = z.infer<typeof recordInstallmentPurchaseInputSchema>;
