import { z } from 'zod';

/**
 * Schema da entrada externa de "calcular fatura de cartao de credito" (spec 008, RF-5,
 * RF-9).
 *
 * `month` e opcional (spec 011, decisao 4.3): quando ausente, calcula a fatura do proximo
 * vencimento a partir de `Clock.now()` (comportamento original, preservado); quando
 * informado, calcula a fatura cujo vencimento cai naquele mes - passado ou futuro (RF-6).
 */
export const calculateCreditCardInvoiceInputSchema = z.object({
  userId: z.string().trim().min(1, 'userId obrigatorio'),
  accountId: z.string().trim().min(1, 'accountId obrigatorio'),
  month: z
    .object({
      year: z.int('year deve ser inteiro'),
      month: z.int('month deve ser inteiro').min(1).max(12),
    })
    .optional(),
});

/** Entrada ja validada e normalizada de `CalculateCreditCardInvoiceUseCase`. */
export type CalculateCreditCardInvoiceInput = z.infer<typeof calculateCreditCardInvoiceInputSchema>;
