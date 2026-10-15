import { z } from 'zod';
import { Transaction } from '../../domain/transaction/transaction.entity.ts';
import { TransactionSeries } from '../../domain/transaction/transaction.series.entity.ts';
import { Income } from '../../domain/income/income.entity.ts';
import { Money } from '../../domain/shared/money.value.object.ts';
import { Recurrence } from '../../domain/shared/recurrence.value.object.ts';
import { UserNotFoundError } from '../../domain/user/user.not.found.error.ts';
import { UserNotVerifiedError } from '../../domain/user/user.not.verified.error.ts';
import { AccountNotFoundError } from '../../domain/account/account.not.found.error.ts';
import { DuplicateTransactionError } from '../../domain/transaction/duplicate.transaction.error.ts';
import { type Database } from '../shared/database.port.ts';
import { type IdGenerator } from '../shared/id.generator.port.ts';
import { InvalidInputError } from '../shared/invalid.input.error.ts';
import { toRecurrence } from '../shared/to.recurrence.ts';
import { resolveCategoryId } from '../category/resolve.category.id.ts';
import { materializeSeries } from './materialize.series.ts';
import { recordTransactionInputSchema } from './record.transaction.input.schema.ts';

/** Fonte generica atribuida ao `Income` espelho criado a partir do Extrato (spec 012, RF-5). */
const MIRROR_INCOME_SOURCE = 'Extrato';

/**
 * Extrai os campos publicos de uma `Transaction` recem-criada (ainda sem `updatedAt`) para
 * reconstrui-la com `incomeId` preenchido (spec 012, RF-5) - `Transaction` nao expoe `props()`
 * fora da propria classe (encapsulamento), entao a borda que precisa "clonar com 1 campo a
 * mais" monta o objeto a partir dos getters publicos.
 */
function candidateProps(transaction: Transaction) {
  return {
    id: transaction.id,
    userId: transaction.userId,
    date: transaction.date,
    amount: transaction.amount,
    type: transaction.type,
    categoryId: transaction.categoryId,
    accountId: transaction.accountId,
    notes: transaction.notes,
    recurrence: transaction.recurrence,
  };
}

/**
 * Caso de uso "registrar transacao manual" (spec 001, RF-5, RF-6; spec 003, RF-25).
 *
 * Valida a entrada com zod, confirma usuario existente e verificado
 * (`UserNotFoundError`/`UserNotVerifiedError` - RF-15, RF-28) e que `accountId` pertence a
 * esse usuario (`AccountNotFoundError` - RF-16). Categoria ausente cai na padrao do usuario
 * (spec 003, CA-7).
 *
 * **Sem recorrencia** (ou `nao-repete`): um unico lancamento, com `findDuplicate` (CA-5)
 * antes de persistir - comportamento da 001.
 *
 * **Com recorrencia**: dentro de `database.transaction()` cria a `TransactionSeries` e
 * materializa TODAS as ocorrencias entre a ancora e a data final (RF-25). A dedup **nao**
 * roda na geracao - as ocorrencias sao criadas de proposito (tarefa 4.8). Depende do
 * `Database` inteiro, nao so do `TransactionRepository`, porque serie + ocorrencias tem que
 * cair na mesma transacao.
 *
 * **`type: income` (spec 012, RF-5)**: alem do lancamento em si, cria um `Income` espelho
 * (mesmo valor/categoria/conta/data/recorrencia) para que o ganho apareca na tela "Ganhos"
 * com o mes ja marcado como lancado. A `Transaction` (avulsa ou cada ocorrencia materializada
 * da serie) e salva com `incomeId` apontando para esse `Income` recem-criado - nunca busca um
 * "espelho" existente (RF-5 so cria, nao reusa). Nao ha `TransactionSeries.incomeId`: o
 * vinculo e sempre `Transaction.incomeId` -> `Income` (Q2), mesmo quando ha uma serie por
 * baixo.
 *
 * Devolve a `Transaction` avulsa, ou a primeira ocorrencia da serie (a da ancora).
 */
export class RecordTransactionUseCase {
  private readonly database: Database;
  private readonly ids: IdGenerator;

  public constructor(database: Database, ids: IdGenerator) {
    this.database = database;
    this.ids = ids;
  }

  /**
   * `options.allowDuplicate`: grava mesmo com um lancamento igual no mesmo dia - so para uso
   * interno com confirmacao explicita do usuario (aprovacao de pre-registro marcado como
   * possivel duplicata, spec 022 FR-027). Fica fora do schema de entrada de proposito: a IPC e
   * o MCP nao podem pular a regra CA-5.
   */
  public async execute(rawInput: unknown, options: { readonly allowDuplicate?: boolean } = {}): Promise<Transaction> {
    const parsed = recordTransactionInputSchema.safeParse(rawInput);
    if (!parsed.success) {
      const flat = z.flattenError(parsed.error);
      throw new InvalidInputError('registrar transacao', flat.fieldErrors, flat.formErrors);
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

    const recurrence = input.recurrence ? toRecurrence(input.recurrence) : undefined;
    const date = new Date(input.date);
    const amount = Money.fromCents(input.amountCents);

    if (recurrence === undefined || !recurrence.repeats()) {
      const categoryId = await resolveCategoryId(this.database.categories, this.ids, input);
      const candidate = Transaction.create({
        id: this.ids.next(),
        userId: input.userId,
        date,
        amount,
        type: input.type,
        categoryId,
        accountId: input.accountId,
        notes: input.notes,
      });
      if (options.allowDuplicate !== true && (await this.database.transactions.findDuplicate(candidate))) {
        throw new DuplicateTransactionError();
      }

      if (input.type !== 'income') {
        await this.database.transactions.save(candidate);
        return candidate;
      }

      return this.database.transaction(async (tx) => {
        const income = await this.createMirrorIncome(tx, {
          userId: input.userId,
          date,
          amount,
          categoryId,
          notes: input.notes,
          accountId: input.accountId,
          recurrence: Recurrence.none(),
        });
        const transaction = Transaction.fromPersistence({
          ...candidateProps(candidate),
          incomeId: income.id,
        });
        await tx.transactions.save(transaction);
        return transaction;
      });
    }

    return this.database.transaction(async (tx) => {
      const categoryId = await resolveCategoryId(tx.categories, this.ids, input);
      const series = TransactionSeries.create({
        id: this.ids.next(),
        userId: input.userId,
        accountId: input.accountId,
        type: input.type,
        amount,
        categoryId,
        notes: input.notes,
        recurrence,
        anchorDate: date,
      });
      await tx.transactionSeries.save(series);

      const incomeId =
        input.type === 'income'
          ? (
              await this.createMirrorIncome(tx, {
                userId: input.userId,
                date,
                amount,
                categoryId,
                notes: input.notes,
                accountId: input.accountId,
                recurrence,
              })
            ).id
          : null;

      // `materializeSeries` gera em ordem crescente de data - a primeira e a da ancora.
      // Uma serie recem-criada sempre gera >= 1 ocorrencia (a ancora <= endDate). Toda
      // ocorrencia (nao so a 1a) recebe o mesmo incomeId (spec 012, RF-5 estendido).
      const [first] = await materializeSeries(tx.transactions, this.ids, series, incomeId);
      return first!;
    });
  }

  /**
   * Cria o `Income` espelho de uma `Transaction` do tipo `income` com conta (spec 012, RF-5).
   * Sempre cria um novo `Income` - nunca busca/reusa um "espelho" existente (a Transaction que
   * disparou este metodo e sempre nova, entao nao ha o que reusar).
   */
  private async createMirrorIncome(
    tx: Database,
    props: {
      readonly userId: string;
      readonly date: Date;
      readonly amount: Money;
      readonly categoryId: string;
      readonly notes: string | undefined;
      readonly accountId: string;
      readonly recurrence: Recurrence;
    },
  ): Promise<Income> {
    const income = Income.create({
      id: this.ids.next(),
      userId: props.userId,
      date: props.date,
      amount: props.amount,
      source: MIRROR_INCOME_SOURCE,
      recurrence: props.recurrence,
      categoryId: props.categoryId,
      notes: props.notes,
      accountId: props.accountId,
    });
    await tx.incomes.save(income);
    return income;
  }
}
