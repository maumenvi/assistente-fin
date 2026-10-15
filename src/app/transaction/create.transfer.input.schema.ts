import { z } from 'zod';

/**
 * Schema da entrada externa de "transferir entre contas" (spec 016, RF-3).
 *
 * `fromAccountId`/`toAccountId` sao validados como contas de saldo existentes (nunca cartao
 * de credito, RF-4) pelo caso de uso, nao aqui - a fronteira so garante presenca/formato.
 */
export const createTransferInputSchema = z.object({
  userId: z.string().trim().min(1, 'userId obrigatorio'),
  fromAccountId: z.string().trim().min(1, 'fromAccountId obrigatorio'),
  toAccountId: z.string().trim().min(1, 'toAccountId obrigatorio'),
  amountCents: z.int('valor deve ser inteiro em centavos').positive('valor deve ser positivo'),
  date: z.iso.datetime({ offset: true }).or(z.iso.date()),
  notes: z.string().trim().max(500, 'notes muito longa').optional(),
});

/** Entrada ja validada de `CreateTransferUseCase`. */
export type CreateTransferInput = z.infer<typeof createTransferInputSchema>;
