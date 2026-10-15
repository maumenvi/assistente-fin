import { z } from 'zod';

/** Schema da entrada externa de "reconciliar saldo da conta". */
export const reconcileAccountBalanceInputSchema = z.object({
  userId: z.string().trim().min(1, 'userId obrigatorio'),
  accountId: z.string().trim().min(1, 'accountId obrigatorio'),
  /** Saldo real observado (ex.: saldo do banco), em centavos. */
  expectedBalanceCents: z.int('saldo esperado deve ser inteiro em centavos'),
  /** Data em que `expectedBalanceCents` foi observado. */
  date: z.iso.datetime({ offset: true }).or(z.iso.date()),
  /**
   * Simula a reconciliacao sem persistir nada (spec 016, RF-17). `true` calcula e devolve o
   * mesmo resultado (saldo antes, diferenca, ajuste que seria criado), mas nao grava a
   * `Transaction` de ajuste. Ausente ou `false` preserva o comportamento atual (grava).
   */
  dryRun: z.boolean().optional(),
});

/** Entrada ja validada de `ReconcileAccountBalanceUseCase`. */
export type ReconcileAccountBalanceInput = z.infer<typeof reconcileAccountBalanceInputSchema>;
