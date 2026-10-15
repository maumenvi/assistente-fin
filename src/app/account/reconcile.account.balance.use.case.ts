import { z } from 'zod';
import { Money } from '../../domain/shared/money.value.object.ts';
import { Transaction } from '../../domain/transaction/transaction.entity.ts';
import { computeAccountBalance } from '../../domain/account/compute.account.balance.ts';
import { AccountNotFoundError } from '../../domain/account/account.not.found.error.ts';
import { type Database } from '../shared/database.port.ts';
import { type IdGenerator } from '../shared/id.generator.port.ts';
import { InvalidInputError } from '../shared/invalid.input.error.ts';
import { ensureAdjustmentCategory } from '../category/ensure.adjustment.category.ts';
import { reconcileAccountBalanceInputSchema } from './reconcile.account.balance.input.schema.ts';

/** Resultado de `ReconcileAccountBalanceUseCase`. */
export interface ReconcileAccountBalanceResult {
  /** `null` quando o saldo informado ja batia com o calculado, ou em `dryRun` (nada criado). */
  readonly adjustment: Transaction | null;
  /** Saldo calculado da conta ate `date`, antes do ajuste. */
  readonly balanceBeforeCents: number;
  /** Eco do saldo esperado informado na entrada (spec 016, RF-17) - util pro agente MCP. */
  readonly expectedBalanceCents: number;
  /**
   * `balanceBeforeCents - expectedBalanceCents` (mesmo sinal usado internamente para montar
   * o ajuste, spec 016, RF-17) - a diferenca encontrada entre o saldo calculado e o esperado.
   */
  readonly deltaCents: number;
  /** Quantas `Transaction` entraram no calculo de `balanceBeforeCents` (spec 016, RF-17). */
  readonly consideredTransactionCount: number;
  /**
   * `true` quando ha diferenca a corrigir (`deltaCents !== 0`), independente de `dryRun` ter
   * persistido o ajuste ou nao (spec 016, RF-17) - permite ao chamador saber se um `dryRun:
   * false` teria criado algo, mesmo sem persistir.
   */
  readonly wouldCreateAdjustment: boolean;
}

/**
 * Caso de uso "reconciliar saldo da conta" - forma correta de corrigir o saldo depois que a
 * conta ja tem movimentacao real (diferente de editar `openingBalanceCents` via
 * `UpdateAccountUseCase`, que so e permitido antes disso).
 *
 * Calcula o saldo real da conta ATE `date` (`computeAccountBalance`, respeitando o piso de
 * `openingBalanceDate` da conta) e gera um AJUSTE (categoria de sistema "AJUSTE", mesma
 * reaproveitada por `UpdateAccountUseCase` antes desta revisao) cujo valor e exatamente
 * `expectedBalanceCents - balanceBeforeCents`, datado de `date`. Sempre `type: 'expense'`
 * (mesma convencao dos demais ajustes - necessario para contar certo na fatura/limite de
 * cartao de credito, que so soma despesas no periodo), podendo ser negativo (estorno).
 *
 * Idempotente: se o saldo calculado ja bate com o informado (`delta === 0`), nenhuma
 * `Transaction` e criada - reconciliar de novo com os mesmos dados nao duplica nada.
 *
 * **`dryRun` (spec 016, RF-17)**: quando `true`, calcula tudo (saldo antes, diferenca,
 * quantas transacoes entraram na conta, e se um ajuste seria criado) mas NAO chama
 * `database.transaction()`/`save` - nenhuma `Transaction` e persistida. Util pra revisar o
 * calculo antes de confirmar, especialmente se o valor informado pelo agente/usuario estiver
 * errado. Comportamento atual (grava o ajuste) e 100% preservado quando `dryRun` e omitido
 * ou `false`.
 */
export class ReconcileAccountBalanceUseCase {
  private readonly database: Database;
  private readonly ids: IdGenerator;

  public constructor(database: Database, ids: IdGenerator) {
    this.database = database;
    this.ids = ids;
  }

  public async execute(rawInput: unknown): Promise<ReconcileAccountBalanceResult> {
    const parsed = reconcileAccountBalanceInputSchema.safeParse(rawInput);
    if (!parsed.success) {
      const flat = z.flattenError(parsed.error);
      throw new InvalidInputError('reconciliar saldo da conta', flat.fieldErrors, flat.formErrors);
    }

    const input = parsed.data;
    const account = await this.database.accounts.findById(input.userId, input.accountId);
    if (!account) {
      throw new AccountNotFoundError();
    }

    const date = new Date(input.date);
    const transactions = await this.database.transactions.listByUser(input.userId);
    const balanceBeforeCents = computeAccountBalance(
      transactions,
      input.accountId,
      date,
      account.openingBalanceDate,
    );
    const consideredTransactionCount = transactions.filter(
      (transaction) =>
        transaction.accountId === input.accountId &&
        transaction.date.getTime() <= date.getTime() &&
        (account.openingBalanceDate === null ||
          transaction.date.getTime() >= account.openingBalanceDate.getTime()),
    ).length;
    // O AJUSTE e sempre `type: 'expense'` (soma no calculo de fatura de cartao,
    // `listExpensesByAccountAndDateRange` so olha despesas). Como despesa SUBTRAI do saldo
    // (computeAccountBalance: income soma, expense subtrai), pra levar o saldo calculado ate
    // o valor esperado o delta e invertido: `balanceBeforeCents - expectedBalanceCents`. Se o
    // esperado for MAIOR que o calculado, o delta fica negativo -> expense negativa (credita),
    // aumentando o saldo; se for MENOR, delta positivo -> expense normal, reduzindo o saldo.
    const deltaCents = balanceBeforeCents - input.expectedBalanceCents;
    const wouldCreateAdjustment = deltaCents !== 0;

    const baseResult = {
      balanceBeforeCents,
      expectedBalanceCents: input.expectedBalanceCents,
      deltaCents,
      consideredTransactionCount,
      wouldCreateAdjustment,
    };

    if (input.dryRun === true || deltaCents === 0) {
      return { ...baseResult, adjustment: null };
    }

    return this.database.transaction(async (tx) => {
      const category = await ensureAdjustmentCategory(tx.categories, this.ids, input.userId);
      const adjustment = Transaction.createAdjustment({
        id: this.ids.next(),
        userId: input.userId,
        date,
        amount: Money.fromCents(deltaCents),
        type: 'expense',
        categoryId: category.id,
        accountId: input.accountId,
        notes: 'Ajuste',
      });
      await tx.transactions.save(adjustment);
      return { ...baseResult, adjustment };
    });
  }
}
