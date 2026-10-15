import { z } from 'zod';
import { categorySelectionSchema } from '../shared/category.selection.schema.ts';
import { recurrenceInputSchema } from '../shared/recurrence.input.schema.ts';

/**
 * Schema da entrada externa de "registrar ganho" (spec 001, RF-2, RF-12).
 *
 * `amountCents` trafega em centavos inteiros (mesma razao de `openingBalanceCents` em
 * `CreateAccount`) - a borda faz a conversao reais<->centavos.
 */
export const registerIncomeInputSchema = z.object({
  userId: z.string().trim().min(1, 'userId obrigatorio'),
  date: z.iso.datetime({ offset: true }).or(z.iso.date()),
  amountCents: z.int('valor deve ser inteiro em centavos').positive('valor deve ser positivo'),
  source: z.string().trim().min(1, 'source obrigatorio').max(120, 'source muito longo'),
  recurrence: recurrenceInputSchema,
  ...categorySelectionSchema,
  notes: z.string().trim().max(120, 'notes muito longa').optional(),
  /**
   * Conta vinculada (spec 012, RF-1/RF-2). A tela "Ganhos" passa a exigir a selecao ao
   * cadastrar (validado na UI, nao aqui - `ApplyScenarioUseCase` continua criando `Income`
   * sem conta, RF-12); ausente = ganho sem conta (nao sincroniza, RF-4).
   */
  accountId: z.string().trim().min(1, 'accountId nao pode ser vazio').optional(),
});

/** Entrada ja validada de `RegisterIncomeUseCase`. */
export type RegisterIncomeInput = z.infer<typeof registerIncomeInputSchema>;
