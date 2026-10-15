import { z } from 'zod';
import { categorySelectionSchema } from '../shared/category.selection.schema.ts';
import { recurrenceInputSchema } from '../shared/recurrence.input.schema.ts';

/**
 * Schema da entrada externa de "atualizar ganho" (spec 002, RF-17, RF-31).
 *
 * Todo campo de mudanca e opcional - so aplica o que vier. `notes: ''` limpa a observacao.
 * `expectedUpdatedAt` (opcional): o `updatedAt` que a borda leu ao abrir a tela - quando
 * presente, o save so grava se o registro nao mudou desde entao (`StaleDataError` senao).
 */
export const updateIncomeInputSchema = z.object({
  id: z.string().trim().min(1, 'id obrigatorio'),
  userId: z.string().trim().min(1, 'userId obrigatorio'),
  expectedUpdatedAt: z.iso.datetime({ offset: true }).optional(),
  date: z.iso.datetime({ offset: true }).or(z.iso.date()).optional(),
  amountCents: z.int('valor deve ser inteiro em centavos').positive('valor deve ser positivo').optional(),
  source: z.string().trim().min(1).max(120, 'source muito longo').optional(),
  recurrence: recurrenceInputSchema.optional(),
  ...categorySelectionSchema,
  notes: z.string().trim().max(120, 'notes muito longa').optional(),
  /**
   * Conta vinculada (spec 012, RF-1/RF-9/RF-14). `null` explicito = desvincular (encerra a
   * serie sincronizada, mesma rotina do RF-9/delete - confirmado com o usuario, plano
   * decisao 9); ausente = nao mexe no vinculo atual.
   */
  accountId: z.string().trim().min(1, 'accountId nao pode ser vazio').nullable().optional(),
});

/** Entrada ja validada de `UpdateIncomeUseCase`. */
export type UpdateIncomeInput = z.infer<typeof updateIncomeInputSchema>;
