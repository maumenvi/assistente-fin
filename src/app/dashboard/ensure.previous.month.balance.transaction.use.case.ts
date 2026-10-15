import { z } from 'zod';
import { type Transaction } from '../../domain/transaction/transaction.entity.ts';
import { Month } from '../../domain/shared/month.value.object.ts';
import { UserNotFoundError } from '../../domain/user/user.not.found.error.ts';
import { UserNotVerifiedError } from '../../domain/user/user.not.verified.error.ts';
import { type Database } from '../shared/database.port.ts';
import { type IdGenerator } from '../shared/id.generator.port.ts';
import { InvalidInputError } from '../shared/invalid.input.error.ts';
import { ensureBalanceCategory } from '../category/ensure.balance.category.ts';
import { resolveBenefitTotalsForMonth } from '../forecast/resolve.benefit.totals.for.month.ts';
import { RecordTransactionUseCase } from '../transaction/record.transaction.use.case.ts';
import { ensurePreviousMonthBalanceInputSchema } from './ensure.previous.month.balance.transaction.input.schema.ts';

/** Resultado de `EnsurePreviousMonthBalanceTransactionUseCase.execute`. */
export interface EnsurePreviousMonthBalanceResult {
  /** `true` se um lancamento foi criado nesta chamada; `false` senao. */
  readonly created: boolean;
  /** Id do lancamento criado; `null` quando `created` e `false`. */
  readonly transactionId: string | null;
}

/**
 * Caso de uso "garantir o lancamento de saldo do mes anterior" (spec 011, RF-16, RF-17,
 * decisao 4.9).
 *
 * Ao visitar `month` pela primeira vez (sem registro em `BalanceGeneration` para aquele
 * ano/mes), calcula o saldo do mes ANTERIOR (ganhos - gastos, excluindo contas-beneficio,
 * incluindo cartao de credito consolidado - as transacoes de cartao sao `Transaction`
 * comuns, entao `resolveBenefitTotalsForMonth` ja as inclui) e cria um lancamento na
 * categoria SALDO, com data no primeiro dia de `month`, na conta padrao do usuario
 * (`User.defaultAccountId`, spec 007) - a spec nao define qual conta usar, e a padrao ja
 * existe para pre-selecao no cadastro de lancamentos.
 *
 * Sem conta padrao configurada, nao ha lancamento possivel (toda `Transaction` exige uma
 * conta, RF-16 da 001): a geracao e marcada mesmo assim (`created: false`) para nao tentar
 * de novo a cada visita ao mes enquanto o usuario nao configurar uma.
 *
 * Sinal do lancamento (decisao 4.9): saldo positivo vira `income` (RF-16 fala em "ganho");
 * saldo negativo vira `expense` de valor absoluto - `Transaction.amount` e sempre positivo
 * (RF-5), entao um "ganho negativo" nao e representavel, e tratar como gasto e a leitura
 * mais direta (sobrou menos que zero). Saldo exatamente zero tambem nao gera lancamento, mas
 * a geracao e marcada do mesmo jeito.
 *
 * Idempotente por `BalanceGeneration` (nao pela presenca da transacao): se o usuario excluir
 * o lancamento gerado (RF-17), a proxima visita ao mes NAO recria - a exclusao e definitiva.
 */
export class EnsurePreviousMonthBalanceTransactionUseCase {
  private readonly database: Database;
  private readonly ids: IdGenerator;

  public constructor(database: Database, ids: IdGenerator) {
    this.database = database;
    this.ids = ids;
  }

  public async execute(rawInput: unknown): Promise<EnsurePreviousMonthBalanceResult> {
    const parsed = ensurePreviousMonthBalanceInputSchema.safeParse(rawInput);
    if (!parsed.success) {
      const flat = z.flattenError(parsed.error);
      throw new InvalidInputError('garantir saldo do mes anterior', flat.fieldErrors, flat.formErrors);
    }

    const input = parsed.data;
    const user = await this.database.users.findById(input.userId);
    if (!user) {
      throw new UserNotFoundError();
    }
    if (!user.isVerified()) {
      throw new UserNotVerifiedError();
    }

    const month = Month.create(input.month);
    const alreadyGenerated = await this.database.balanceGenerations.existsFor(
      input.userId,
      month.year,
      month.month,
    );
    if (alreadyGenerated) {
      return { created: false, transactionId: null };
    }

    let transaction: Transaction | null = null;
    if (user.defaultAccountId !== null) {
      const previousMonth = month.previous();
      const summary = await resolveBenefitTotalsForMonth(
        input.userId,
        previousMonth,
        this.database.transactions,
        this.database.accounts,
      );
      const balanceCents = summary.income.general.cents - summary.expense.general.cents;

      if (balanceCents !== 0) {
        const category = await ensureBalanceCategory(this.database.categories, this.ids, input.userId);
        const recordTransaction = new RecordTransactionUseCase(this.database, this.ids);
        transaction = await recordTransaction.execute({
          userId: input.userId,
          date: new Date(Date.UTC(month.year, month.month - 1, 1)).toISOString(),
          amountCents: Math.abs(balanceCents),
          type: balanceCents > 0 ? 'income' : 'expense',
          categoryId: category.id,
          accountId: user.defaultAccountId,
        });
      }
    }

    await this.database.balanceGenerations.markGenerated(input.userId, month.year, month.month);

    return { created: transaction !== null, transactionId: transaction?.id ?? null };
  }
}
