import { z } from 'zod';
import { type Account } from '../../domain/account/account.entity.ts';
import { Transaction } from '../../domain/transaction/transaction.entity.ts';
import { Money } from '../../domain/shared/money.value.object.ts';
import { AccountNotFoundError } from '../../domain/account/account.not.found.error.ts';
import { type Database } from '../shared/database.port.ts';
import { type IdGenerator } from '../shared/id.generator.port.ts';
import { InvalidInputError } from '../shared/invalid.input.error.ts';
import { ensureOpeningBalanceCategory } from '../category/ensure.opening.balance.category.ts';
import { updateAccountInputSchema } from './update.account.input.schema.ts';

/**
 * Caso de uso "atualizar conta" (spec 001, RF-1).
 *
 * Busca a conta no escopo do usuario (RF-16); `AccountNotFoundError` se nao existir ou for
 * de outro usuario (CA-14). So aplica os campos presentes na entrada. Carrega
 * `expectedUpdatedAt` (a versao que a borda leu) via `withUpdatedAt` - o `save` compara com
 * o banco e lanca `StaleDataError` se mudou (RF-31); sem ele, usa a versao lida agora.
 *
 * **Editar o saldo inicial cru so e permitido antes de a conta ter movimentacao real**
 * (revisao do bug de saldo inicial vs. saldo atual): se ja existe qualquer `Transaction` na
 * conta alem da propria "SALDO INICIAL" gerada por `CreateAccountUseCase`, mudar
 * `openingBalanceCents`/`openingBalanceDate` aqui e rejeitado (`InvalidInputError`) - o
 * caminho correto nesse caso e `ReconcileAccountBalanceUseCase`, que sabe calcular o delta
 * certo a partir do que ja foi lancado. Isso substitui o AJUSTE automatico implicito que
 * existia antes: editar a conta nunca mais dispara ajuste de saldo por conta propria.
 *
 * `kind` pode ser trocado entre tipos "comuns" (`account.changeKind`) - de/para `credit-card`
 * continua fora de escopo, a entidade lanca `InvalidAccountError` nesse caso.
 *
 * **Sincronizacao da `Transaction` "SALDO INICIAL" (spec 018, RF-28)**: dentro da janela
 * permitida acima, editar `openingBalanceCents`/`openingBalanceDate` tambem atualiza a
 * `Transaction` "SALDO INICIAL" correspondente (`findOpeningBalanceTransaction`), na mesma
 * `database.transaction()` da conta - as duas fontes (`accounts.opening_balance_cents` e a
 * transacao materializada no extrato) nunca ficam divergentes depois desta operacao. Se a
 * conta nunca teve saldo inicial lancado (criada com `openingBalanceCents === 0`) e o novo
 * valor e positivo, a `Transaction` e criada agora, mesmo mecanismo de `CreateAccountUseCase`
 * (incluindo a mesma regra de sinal por `kind` - RF-14).
 */
export class UpdateAccountUseCase {
  private readonly database: Database;
  private readonly ids: IdGenerator;

  public constructor(database: Database, ids: IdGenerator) {
    this.database = database;
    this.ids = ids;
  }

  public async execute(rawInput: unknown): Promise<Account> {
    const parsed = updateAccountInputSchema.safeParse(rawInput);
    if (!parsed.success) {
      const flat = z.flattenError(parsed.error);
      throw new InvalidInputError('atualizar conta', flat.fieldErrors, flat.formErrors);
    }

    const input = parsed.data;
    const existing = await this.database.accounts.findById(input.userId, input.id);
    if (!existing) {
      throw new AccountNotFoundError();
    }

    const expected =
      input.expectedUpdatedAt !== undefined
        ? new Date(input.expectedUpdatedAt)
        : existing.updatedAt;

    const changesOpeningBalance =
      input.openingBalanceCents !== undefined || input.openingBalanceDate !== undefined;
    if (changesOpeningBalance) {
      await this.assertNoRealMovement(input.userId, input.id);
    }

    return this.database.transaction(async (tx) => {
      let account = existing;
      if (input.name !== undefined) {
        account = account.rename(input.name);
      }
      if (input.kind !== undefined) {
        account = account.changeKind(input.kind);
      }
      if (changesOpeningBalance) {
        const openingBalance =
          input.openingBalanceCents !== undefined
            ? Money.fromCents(input.openingBalanceCents)
            : account.openingBalance;
        const openingBalanceDate =
          input.openingBalanceDate !== undefined
            ? new Date(input.openingBalanceDate)
            : account.openingBalanceDate;
        account = account.changeOpeningBalance(openingBalance, openingBalanceDate);
        await this.syncOpeningBalanceTransaction(tx, account, openingBalance, openingBalanceDate);
      }
      if (input.archived !== undefined) {
        account = input.archived ? account.archive() : account.unarchive();
      }
      if (input.isBenefit !== undefined) {
        account = account.changeBenefitFlag(input.isBenefit);
      }
      if (
        input.creditLimitCents !== undefined ||
        input.closingDay !== undefined ||
        input.dueDay !== undefined
      ) {
        // `changeCreditCardTerms` exige os tres: em conta ja cadastrada com termos, o campo
        // ausente na entrada mantem o valor atual (spec 008 revisao, RF-1, RF-2).
        const creditLimit =
          input.creditLimitCents !== undefined
            ? Money.fromCents(input.creditLimitCents)
            : account.creditLimit;
        const closingDay = input.closingDay !== undefined ? input.closingDay : account.closingDay;
        const dueDay = input.dueDay !== undefined ? input.dueDay : account.dueDay;
        if (creditLimit === null || closingDay === null || dueDay === null) {
          throw new InvalidInputError(
            'atualizar conta',
            {
              creditLimitCents: [
                'creditLimitCents, closingDay e dueDay devem ser informados juntos',
              ],
            },
            [],
          );
        }
        account = account.changeCreditCardTerms(creditLimit, closingDay, dueDay);
      }

      account = account.withUpdatedAt(expected);

      await tx.accounts.save(account);
      // rele a versao persistida: `save` recarimba o `updatedAt` (RF-31) e quem chama
      // (borda / futura CLI) precisa do valor real, nao do que acabamos de enviar.
      return (await tx.accounts.findById(input.userId, input.id)) ?? account;
    });
  }

  /**
   * Rejeita editar o saldo inicial cru se a conta ja tem alguma `Transaction` real - a unica
   * excecao tolerada e a propria "SALDO INICIAL" gerada por `CreateAccountUseCase` (categoria
   * de sistema `isSystemOpeningBalance`), que nao conta como "movimentacao real" ainda.
   */
  private async assertNoRealMovement(userId: string, accountId: string): Promise<void> {
    const openingBalanceCategory = await this.database.categories.findSystemOpeningBalance(userId);
    const transactions = await this.database.transactions.listByUser(userId);
    const hasRealMovement = transactions.some(
      (transaction) =>
        transaction.accountId === accountId &&
        transaction.categoryId !== openingBalanceCategory?.id,
    );
    if (hasRealMovement) {
      throw new InvalidInputError(
        'atualizar conta',
        {
          openingBalanceCents: [
            'saldo inicial so pode ser editado antes de a conta ter movimentacao real; use a reconciliacao de saldo',
          ],
        },
        [],
      );
    }
  }

  /**
   * Mantem a `Transaction` "SALDO INICIAL" sincronizada com o novo `openingBalance`/
   * `openingBalanceDate` (spec 018, RF-28): atualiza a existente se houver, ou cria agora se
   * a conta nunca teve saldo inicial lancado e o novo valor e positivo. Mesma regra de sinal
   * de `CreateAccountUseCase` (cartao de credito: divida/`expense`; demais: disponivel/
   * `income`).
   */
  private async syncOpeningBalanceTransaction(
    tx: Database,
    account: Account,
    openingBalance: Money,
    openingBalanceDate: Date | null,
  ): Promise<void> {
    const category = await ensureOpeningBalanceCategory(tx.categories, this.ids, account.userId);
    const existingTransaction = await tx.transactions.findOpeningBalanceTransaction(
      account.userId,
      account.id,
      category.id,
    );

    if (existingTransaction) {
      const updated = Transaction.create({
        id: existingTransaction.id,
        userId: account.userId,
        date: openingBalanceDate ?? existingTransaction.date,
        amount: openingBalance,
        type: account.kind === 'credit-card' ? 'expense' : 'income',
        categoryId: category.id,
        accountId: account.id,
        notes: existingTransaction.notes ?? 'Saldo inicial',
      }).withUpdatedAt(existingTransaction.updatedAt);
      await tx.transactions.save(updated);
      return;
    }

    if (openingBalance.cents > 0 && openingBalanceDate !== null) {
      const created = Transaction.create({
        id: this.ids.next(),
        userId: account.userId,
        date: openingBalanceDate,
        amount: openingBalance,
        type: account.kind === 'credit-card' ? 'expense' : 'income',
        categoryId: category.id,
        accountId: account.id,
        notes: 'Saldo inicial',
      });
      await tx.transactions.save(created);
    }
  }
}
