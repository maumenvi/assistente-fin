import { z } from 'zod';
import { PAYMENT_METHODS } from '../../domain/simulation/payment.method.ts';

/**
 * Campos editaveis de um pre-registro na fronteira (spec 022, FR-022/FR-023). Todos opcionais;
 * `null` limpa o campo. As regras finas (parcelas so no credito etc.) ficam na entidade.
 */
export const preRegistrationFieldsSchema = {
  amountCents: z.int('valor deve ser inteiro em centavos').positive('valor deve ser positivo').nullable().optional(),
  description: z.string().trim().max(200, 'descricao muito longa').nullable().optional(),
  date: z.iso.datetime({ offset: true }).or(z.iso.date()).nullable().optional(),
  accountId: z.string().trim().min(1).nullable().optional(),
  paymentMethod: z.enum(PAYMENT_METHODS).nullable().optional(),
  installments: z.int().min(1).max(48).nullable().optional(),
  categoryId: z.string().trim().min(1).nullable().optional(),
  notes: z.string().trim().max(500, 'observacao muito longa').nullable().optional(),
};
