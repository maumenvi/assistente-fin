import { z } from 'zod';

/** Entrada de "posso comprar?" (spec 022, FR-040/FR-041). */
export const evaluatePurchaseInputSchema = z.object({
  userId: z.string().trim().min(1, 'userId obrigatorio'),
  amountCents: z.int('valor deve ser inteiro em centavos').positive('valor deve ser positivo'),
  accountId: z.string().trim().min(1, 'escolha a conta ou o cartao'),
  installments: z.int().min(1).max(48).default(1),
  date: z.iso.datetime({ offset: true }).or(z.iso.date()).optional(),
  /** Margem de seguranca (FR-041): padrao 20%, configuravel entre 5% e 50%. */
  safetyMargin: z.number().min(0.05).max(0.5).default(0.2),
  horizonMonths: z.int().min(1).max(24).default(6),
});

export type EvaluatePurchaseInput = z.infer<typeof evaluatePurchaseInputSchema>;
