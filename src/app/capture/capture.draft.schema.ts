import { z } from 'zod';
import { PAYMENT_METHODS } from '../../domain/simulation/payment.method.ts';

/**
 * `CaptureDraft` validado na fronteira (spec 022; constitution III): tudo que vem de parser,
 * reconhecimento no aparelho ou IA passa por aqui antes de virar pre-registro.
 */
export const captureDraftSchema = z.object({
  origin: z.enum(['nfce', 'receipt', 'wallet', 'voice']),
  amountCents: z.int().positive().optional(),
  date: z.iso.date().optional(),
  description: z.string().trim().min(1).max(200).optional(),
  accountHint: z.string().trim().min(1).max(80).optional(),
  paymentMethod: z.enum(PAYMENT_METHODS).optional(),
  installments: z.int().min(1).max(48).optional(),
  notes: z.string().trim().max(500).optional(),
  link: z.string().trim().max(500).optional(),
  dedupKey: z.string().trim().min(1).max(200).optional(),
  confidence: z.enum(['high', 'low']),
});
