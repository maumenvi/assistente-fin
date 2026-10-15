import { z } from 'zod';
import { ACCOUNT_KINDS } from '../../domain/account/account.kind.ts';

/**
 * Schema da entrada externa de "criar conta" (spec 001, RF-1, RF-12).
 *
 * O saldo inicial trafega como centavos inteiros (`openingBalanceCents`) para nao carregar
 * imprecisao de ponto flutuante ate o dominio; a borda (UI) faz a conversao reais<->centavos.
 */
export const createAccountInputSchema = z.object({
  userId: z.string().trim().min(1, 'userId obrigatorio'),
  name: z.string().trim().min(1, 'nome obrigatorio').max(120, 'nome muito longo'),
  kind: z.enum(ACCOUNT_KINDS),
  openingBalanceCents: z.int('saldo inicial deve ser inteiro em centavos'),
  /**
   * Data em que `openingBalanceCents` foi observado (ISO). Obrigatoria quando o saldo e
   * diferente de zero - reforcado tambem na entidade (`Account.create`).
   */
  openingBalanceDate: z.iso.datetime({ offset: true }).or(z.iso.date()).optional(),
  /** So se aplica a `kind: 'credit-card'` (spec 008, RF-1, RF-3) - validado no dominio. */
  creditLimitCents: z.int('creditLimitCents deve ser inteiro').positive().optional(),
  /**
   * So se aplica a `kind: 'credit-card'` (spec 008 revisao, RF-2, RF-3) - validado no
   * dominio, incluindo `closingDay !== dueDay`.
   */
  closingDay: z.int('closingDay deve ser inteiro').min(1).max(31).optional(),
  /** So se aplica a `kind: 'credit-card'` (spec 008, RF-2, RF-3) - validado no dominio. */
  dueDay: z.int('dueDay deve ser inteiro').min(1).max(31).optional(),
  /** Marca a conta como beneficio (spec 011, RF-9). Disponivel para qualquer `kind`. */
  isBenefit: z.boolean().optional(),
});

/** Entrada ja validada e normalizada de `CreateAccountUseCase`. */
export type CreateAccountInput = z.infer<typeof createAccountInputSchema>;
