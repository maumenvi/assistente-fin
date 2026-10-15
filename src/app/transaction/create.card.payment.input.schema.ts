import { z } from 'zod';

/**
 * Schema da entrada externa de "pagar fatura do cartao" (spec 016, RF-6).
 *
 * `payingAccountId`/`cardAccountId` sao validados pelo caso de uso, nao aqui: `cardAccountId`
 * precisa ser `kind: 'credit-card'` e `payingAccountId` precisa ser o contrario (RF-4
 * invertido) - cartao de credito nao e conta de saldo, decisao de modelo desta spec.
 */
export const createCardPaymentInputSchema = z.object({
  userId: z.string().trim().min(1, 'userId obrigatorio'),
  payingAccountId: z.string().trim().min(1, 'payingAccountId obrigatorio'),
  cardAccountId: z.string().trim().min(1, 'cardAccountId obrigatorio'),
  amountCents: z.int('valor deve ser inteiro em centavos').positive('valor deve ser positivo'),
  date: z.iso.datetime({ offset: true }).or(z.iso.date()),
  notes: z.string().trim().max(500, 'notes muito longa').optional(),
});

/** Entrada ja validada de `CreateCardPaymentUseCase`. */
export type CreateCardPaymentInput = z.infer<typeof createCardPaymentInputSchema>;
