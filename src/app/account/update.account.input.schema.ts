import { z } from 'zod';
import { ACCOUNT_KINDS } from '../../domain/account/account.kind.ts';

/**
 * Schema da entrada externa de "atualizar conta" (spec 001, RF-1, RF-12).
 *
 * Todo campo de mudanca e opcional: so aplica o que vier preenchido (`rename`,
 * `changeOpeningBalance`, `changeKind`, `archive`/`unarchive` da entidade `Account`). `kind`
 * so aceita trocas entre tipos "comuns" - `Account.changeKind` rejeita de/para `credit-card`.
 *
 * `expectedUpdatedAt` (opcional): o `updatedAt` que a borda leu ao abrir a tela - quando
 * presente, o save so grava se o registro nao mudou desde entao (`StaleDataError` senao,
 * RF-31). Mesmo padrao de `updateIncomeInputSchema`.
 */
export const updateAccountInputSchema = z.object({
  id: z.string().trim().min(1, 'id obrigatorio'),
  userId: z.string().trim().min(1, 'userId obrigatorio'),
  expectedUpdatedAt: z.iso.datetime({ offset: true }).optional(),
  name: z.string().trim().min(1, 'nome obrigatorio').max(120, 'nome muito longo').optional(),
  kind: z.enum(ACCOUNT_KINDS).optional(),
  /**
   * So aceito quando a conta ainda nao tem nenhuma Transaction real (correcao de um erro de
   * digitacao logo apos criar a conta) - `UpdateAccountUseCase` rejeita senao. Depois que a
   * conta ja tem movimentacao, use `account.reconcileBalance` em vez deste campo.
   */
  openingBalanceCents: z.int('saldo inicial deve ser inteiro em centavos').optional(),
  openingBalanceDate: z.iso.datetime({ offset: true }).or(z.iso.date()).optional(),
  archived: z.boolean().optional(),
  /** So se aplica a `kind: 'credit-card'` (spec 008, RF-1, RF-3) - validado no dominio. */
  creditLimitCents: z.int('creditLimitCents deve ser inteiro').positive().optional(),
  /**
   * So se aplica a `kind: 'credit-card'` (spec 008 revisao, RF-2, RF-3) - validado no
   * dominio, incluindo `closingDay !== dueDay`.
   */
  closingDay: z.int('closingDay deve ser inteiro').min(1).max(31).optional(),
  /** So se aplica a `kind: 'credit-card'` (spec 008, RF-2, RF-3) - validado no dominio. */
  dueDay: z.int('dueDay deve ser inteiro').min(1).max(31).optional(),
  /** Marca/desmarca a conta como beneficio (spec 011, RF-9). Disponivel para qualquer `kind`. */
  isBenefit: z.boolean().optional(),
});

/** Entrada ja validada de `UpdateAccountUseCase`. */
export type UpdateAccountInput = z.infer<typeof updateAccountInputSchema>;
