import { z } from 'zod';
import { Transaction } from '../../domain/transaction/transaction.entity.ts';
import { Month } from '../../domain/shared/month.value.object.ts';
import { IncomeNotFoundError } from '../../domain/income/income.not.found.error.ts';
import { IncomeWithoutAccountError } from '../../domain/income/income.without.account.error.ts';
import { IncomeMonthAlreadyLaunchedError } from '../../domain/income/income.month.already.launched.error.ts';
import { AccountNotFoundError } from '../../domain/account/account.not.found.error.ts';
import { clampDayInMonth } from '../../libs/date/clamp.day.in.month.ts';
import { type Database } from '../shared/database.port.ts';
import { type IdGenerator } from '../shared/id.generator.port.ts';
import { InvalidInputError } from '../shared/invalid.input.error.ts';
import { listLaunchedIncomeMonths } from './list.launched.income.months.ts';
import { launchIncomeMonthInputSchema } from './launch.income.month.input.schema.ts';

/**
 * Caso de uso "lancar o mes de um ganho no Extrato" (spec 012, RF-3/RF-7).
 *
 * Cria um `Transaction` avulso (`type: income`, mesma conta/valor/categoria/notas do
 * `Income`) vinculado ao `Income` de origem via `incomeId`. Idempotente por mes (RF-7): se o
 * mes pedido ja tem uma `Transaction` vinculada aquele `Income`, rejeita com
 * `IncomeMonthAlreadyLaunchedError` sem criar nada.
 *
 * Nao abre `database.transaction()`: so grava em um unico agregado (`Transaction`), ao
 * contrario do mecanismo automatico descartado (que precisava sincronizar `Income` +
 * `TransactionSeries` + ocorrencias atomicamente).
 */
export class LaunchIncomeMonthUseCase {
  private readonly database: Database;
  private readonly ids: IdGenerator;

  public constructor(database: Database, ids: IdGenerator) {
    this.database = database;
    this.ids = ids;
  }

  public async execute(rawInput: unknown): Promise<Transaction> {
    const parsed = launchIncomeMonthInputSchema.safeParse(rawInput);
    if (!parsed.success) {
      const flat = z.flattenError(parsed.error);
      throw new InvalidInputError('lancar mes do ganho', flat.fieldErrors, flat.formErrors);
    }

    const input = parsed.data;
    const income = await this.database.incomes.findById(input.userId, input.incomeId);
    if (!income) {
      throw new IncomeNotFoundError();
    }
    if (income.accountId === null) {
      throw new IncomeWithoutAccountError();
    }

    const targetMonth = Month.create(input.month);
    const transactions = await this.database.transactions.listByUser(input.userId);
    const launched = listLaunchedIncomeMonths(transactions, income.id);
    if (launched.has(targetMonth.toString())) {
      throw new IncomeMonthAlreadyLaunchedError();
    }

    const account = await this.database.accounts.findById(input.userId, income.accountId);
    if (!account) {
      throw new AccountNotFoundError();
    }

    const date = clampDayInMonth(income.date.getUTCDate(), targetMonth);
    const transaction = Transaction.create({
      id: this.ids.next(),
      userId: input.userId,
      date,
      amount: income.amount,
      type: 'income',
      categoryId: income.categoryId,
      accountId: income.accountId,
      notes: income.notes,
      incomeId: income.id,
    });
    await this.database.transactions.save(transaction);
    return transaction;
  }
}
