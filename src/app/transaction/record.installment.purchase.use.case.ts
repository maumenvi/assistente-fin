import { z } from 'zod';
import { Transaction } from '../../domain/transaction/transaction.entity.ts';
import { Money } from '../../domain/shared/money.value.object.ts';
import { addUtcMonths } from '../../domain/shared/add.utc.months.ts';
import { UserNotFoundError } from '../../domain/user/user.not.found.error.ts';
import { UserNotVerifiedError } from '../../domain/user/user.not.verified.error.ts';
import { AccountNotFoundError } from '../../domain/account/account.not.found.error.ts';
import { buildInstallmentPlan } from '../../domain/money/split.evenly.ts';
import { type Database } from '../shared/database.port.ts';
import { type IdGenerator } from '../shared/id.generator.port.ts';
import { InvalidInputError } from '../shared/invalid.input.error.ts';
import { resolveCategoryId } from '../category/resolve.category.id.ts';
import { recordInstallmentPurchaseInputSchema } from './record.installment.purchase.input.schema.ts';

/**
 * Caso de uso "registrar compra parcelada" (spec 009, RF-1, RF-2, RF-3, RF-4; spec 016, RF-1 -
 * parcelamento deixa de ser exclusivo de cartao de credito, para cobrir Pix parcelado em
 * conta corrente/carteira).
 *
 * Valida a entrada com zod, confirma usuario existente e verificado (mesmo padrao de
 * `RecordTransactionUseCase`) e que `accountId` pertence a esse usuario. Qualquer `kind` de
 * conta pode receber parcelas - "saldo comprometido"/limite de fatura (spec 014) continuam
 * exclusivos de `credit-card`, calculados a parte por `CalculateCreditCardCommittedBalanceUseCase`.
 *
 * **`installments === 1`** (RF-10/CA-9): delega para um unico `Transaction` comum, sem
 * nenhum campo de parcela preenchido - nao usa o mecanismo de agrupamento.
 *
 * **`installments > 1`**: gera um `installmentGroupId` novo, distribui o valor total entre
 * as parcelas com `buildInstallmentPlan` (RF-3/CA-2 - a soma bate exatamente com o total) e
 * calcula a data de cada parcela avancando um mes por parcela a partir da data da compra
 * (`addUtcMonths`, RF-2/CA-1, decisao 4.6 - clampa em fim de mes quando o dia da compra nao
 * existir no mes de destino). Persiste as N `Transaction` dentro de `database.transaction()`
 * (decisao 4.2 - unit-of-work ja existente no projeto) para garantir atomicidade: uma falha
 * no meio da gravacao nao deixa nenhuma parcela persistida.
 *
 * Devolve todas as parcelas geradas, em ordem (ou o unico lancamento, se `installments === 1`).
 */
export class RecordInstallmentPurchaseUseCase {
  private readonly database: Database;
  private readonly ids: IdGenerator;

  public constructor(database: Database, ids: IdGenerator) {
    this.database = database;
    this.ids = ids;
  }

  public async execute(rawInput: unknown): Promise<Transaction[]> {
    const parsed = recordInstallmentPurchaseInputSchema.safeParse(rawInput);
    if (!parsed.success) {
      const flat = z.flattenError(parsed.error);
      throw new InvalidInputError('registrar compra parcelada', flat.fieldErrors, flat.formErrors);
    }

    const input = parsed.data;
    const user = await this.database.users.findById(input.userId);
    if (!user) {
      throw new UserNotFoundError();
    }
    if (!user.isVerified()) {
      throw new UserNotVerifiedError();
    }
    const account = await this.database.accounts.findById(input.userId, input.accountId);
    if (!account) {
      throw new AccountNotFoundError();
    }

    const date = new Date(input.date);

    if (input.installments === 1) {
      const categoryId = await resolveCategoryId(this.database.categories, this.ids, input);
      const transaction = Transaction.create({
        id: this.ids.next(),
        userId: input.userId,
        date,
        amount: Money.fromCents(input.amountCents),
        type: 'expense',
        categoryId,
        accountId: input.accountId,
        notes: input.notes,
      });
      await this.database.transactions.save(transaction);
      return [transaction];
    }

    const plan = buildInstallmentPlan(input.amountCents, input.installments);
    const installmentGroupId = this.ids.next();

    return this.database.transaction(async (tx) => {
      const categoryId = await resolveCategoryId(tx.categories, this.ids, input);
      const installments: Transaction[] = [];
      for (let index = 0; index < plan.length; index += 1) {
        const transaction = Transaction.create({
          id: this.ids.next(),
          userId: input.userId,
          date: addUtcMonths(date, index),
          amount: Money.fromCents(plan[index]!),
          type: 'expense',
          categoryId,
          accountId: input.accountId,
          notes: input.notes,
          installmentGroupId,
          installmentNumber: index + 1,
          installmentTotal: plan.length,
        });
        await tx.transactions.save(transaction);
        installments.push(transaction);
      }
      return installments;
    });
  }
}
