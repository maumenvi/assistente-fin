import { z } from 'zod';
import { categorySelectionSchema } from '../shared/category.selection.schema.ts';
import { PAYMENT_METHODS } from '../../domain/simulation/payment.method.ts';
import { recurrenceInputSchema } from '../shared/recurrence.input.schema.ts';

/**
 * Schema da entrada externa de "simular compra" (spec 001, RF-9, RF-12).
 *
 * `installments` default 1 (a vista) e `recurrence` default `{ kind: 'none' }` - o chamador
 * so precisa informar o que se aplica ao modo desejado (CA-8..CA-10); a entidade rejeita a
 * combinacao de ambos (plan.md, decisao 13).
 */
export const simulatePurchaseInputSchema = z.object({
  userId: z.string().trim().min(1, 'userId obrigatorio'),
  amountCents: z.int('valor deve ser inteiro em centavos').positive('valor deve ser positivo'),
  date: z.iso.datetime({ offset: true }).or(z.iso.date()),
  ...categorySelectionSchema,
  payment: z.enum(PAYMENT_METHODS),
  installments: z.int('installments deve ser inteiro').min(1).default(1),
  recurrence: recurrenceInputSchema.optional(),
  accountId: z.string().trim().min(1, 'accountId obrigatorio'),
  /** So usado no modo recorrente (CA-10) - quantos meses pra frente projetar. Default 12. */
  horizonMonths: z.int().min(1).max(60).optional(),
  /** Repassado pro calculo de previsao de cada mes afetado (RF-19). Default 3 meses se ausente. */
  windowMonths: z.int().min(1).max(24).optional(),
});

/** Entrada ja validada de `SimulatePurchaseUseCase`. */
export type SimulatePurchaseInput = z.infer<typeof simulatePurchaseInputSchema>;
