import { z } from 'zod';
import { Income } from '../../domain/income/income.entity.ts';
import { Money } from '../../domain/shared/money.value.object.ts';
import { toRecurrence } from '../shared/to.recurrence.ts';
import { UserNotFoundError } from '../../domain/user/user.not.found.error.ts';
import { UserNotVerifiedError } from '../../domain/user/user.not.verified.error.ts';
import { AccountNotFoundError } from '../../domain/account/account.not.found.error.ts';
import { type Database } from '../shared/database.port.ts';
import { type IdGenerator } from '../shared/id.generator.port.ts';
import { InvalidInputError } from '../shared/invalid.input.error.ts';
import { resolveCategoryId } from '../category/resolve.category.id.ts';
import { registerIncomeInputSchema } from './register.income.input.schema.ts';

/**
 * Caso de uso "registrar ganho" (spec 001, RF-2, CA-2; spec 012, RF-1/RF-2).
 *
 * Valida a entrada externa com zod na fronteira, confirma que `userId` existe e esta
 * verificado (`UserNotFoundError`/`UserNotVerifiedError` - RF-15, RF-28, mesma regra de
 * `CreateAccount`), gera o id pela porta injetada, constroi a entidade e persiste.
 *
 * Com `accountId` (spec 012, RF-1/RF-2): confirma que a conta pertence ao usuario
 * (`AccountNotFoundError`, RF-16 da 001) e salva o `Income` com o vinculo. Nao cria nem
 * sincroniza nenhum `Transaction`/`TransactionSeries` aqui - o lancamento de cada mes exige
 * o clique explicito do usuario (`LaunchIncomeMonthUseCase`, RF-3).
 *
 * Sem `accountId`: comportamento identico ao anterior a esta spec (RF-4).
 */
export class RegisterIncomeUseCase {
  private readonly database: Database;
  private readonly ids: IdGenerator;

  public constructor(database: Database, ids: IdGenerator) {
    this.database = database;
    this.ids = ids;
  }

  public async execute(rawInput: unknown): Promise<Income> {
    const parsed = registerIncomeInputSchema.safeParse(rawInput);
    if (!parsed.success) {
      const flat = z.flattenError(parsed.error);
      throw new InvalidInputError('registrar ganho', flat.fieldErrors, flat.formErrors);
    }

    const input = parsed.data;
    const user = await this.database.users.findById(input.userId);
    if (!user) {
      throw new UserNotFoundError();
    }
    if (!user.isVerified()) {
      throw new UserNotVerifiedError();
    }

    if (input.accountId !== undefined) {
      const account = await this.database.accounts.findById(input.userId, input.accountId);
      if (!account) {
        throw new AccountNotFoundError();
      }
    }

    const categoryId = await resolveCategoryId(this.database.categories, this.ids, input);
    const income = Income.create({
      id: this.ids.next(),
      userId: input.userId,
      date: new Date(input.date),
      amount: Money.fromCents(input.amountCents),
      source: input.source,
      recurrence: toRecurrence(input.recurrence),
      categoryId,
      notes: input.notes,
      accountId: input.accountId,
    });
    await this.database.incomes.save(income);
    return income;
  }
}
