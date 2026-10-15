import { z } from 'zod';
import { Account } from '../../domain/account/account.entity.ts';
import { Transaction } from '../../domain/transaction/transaction.entity.ts';
import { Money } from '../../domain/shared/money.value.object.ts';
import { UserNotFoundError } from '../../domain/user/user.not.found.error.ts';
import { UserNotVerifiedError } from '../../domain/user/user.not.verified.error.ts';
import { type Database } from '../shared/database.port.ts';
import { type IdGenerator } from '../shared/id.generator.port.ts';
import { InvalidInputError } from '../shared/invalid.input.error.ts';
import { ensureOpeningBalanceCategory } from '../category/ensure.opening.balance.category.ts';
import { createAccountInputSchema } from './create.account.input.schema.ts';

/**
 * Caso de uso "criar conta" (spec 001, RF-1, CA-1).
 *
 * Valida a entrada externa com zod na fronteira (`safeParse`, nunca `parse`), confirma que
 * `userId` existe (`UserNotFoundError` senao - RF-15) e que o usuario tem e-mail e telefone
 * verificados (`UserNotVerifiedError` senao - RF-28, CA-24), gera o id pela porta injetada,
 * constroi a entidade de dominio e persiste. Nao conhece HTTP/UI.
 *
 * **Saldo/gasto inicial vira lancamento (spec 015, revisado)**: quando `openingBalanceCents >
 * 0`, alem de gravar o campo na propria conta (mantido por compatibilidade com o calculo de
 * saldo do Dashboard - `computeAccountBalance`), gera dentro da mesma `database.transaction()`
 * uma `Transaction` na categoria de sistema "SALDO INICIAL" (spec 011 ja tem o precedente de
 * categoria de sistema para lancamento automatico - `ensureBalanceCategory`). Assim o valor
 * passa a aparecer no Extrato e a contar na fatura/limite de cartao de credito (RF-8 desta
 * revisao), que sao calculados so a partir de `Transaction`s reais.
 *
 * `type` depende de `kind` (bug corrigido: saldo inicial derrubava o saldo calculado de
 * contas comuns): em cartao de credito, saldo inicial positivo e divida - `expense`, do jeito
 * que `listExpensesByAccountAndDateRange` (fatura/limite) ja espera. Em qualquer outra conta,
 * saldo inicial positivo e dinheiro disponivel - `income`, senao `computeAccountBalance`
 * (ganho soma, gasto subtrai) subtraia o proprio saldo inicial em vez de soma-lo.
 *
 * **Regra contabil formal por tipo de conta (spec 016, RF-14)**: conta de saldo (corrente,
 * poupanca, carteira, beneficio - qualquer `kind` exceto `credit-card`) com saldo inicial
 * positivo aumenta o saldo disponivel (usado tambem por `computeTotalAvailableBalance`,
 * spec 016, RF-12); conta de cartao de credito com saldo inicial positivo representa divida
 * ja existente, nunca saldo disponivel. Testado explicitamente em
 * `create.account.use.case.test.ts`.
 *
 * Grava a `Transaction` direto (`tx.transactions.save`), sem passar por
 * `RecordTransactionUseCase`: esse caso de uso cria automaticamente um `Income` espelho para
 * toda `Transaction` do tipo `income` com conta (spec 012, RF-5, pensado para lancamento
 * manual no Extrato) - "SALDO INICIAL" e sintetica, nao deve aparecer como ganho na tela
 * "Ganhos".
 *
 * A transacao nasce em `openingBalanceDate` (a data em que o saldo foi observado/apurado),
 * NAO em `new Date()` como antes - datar sempre de "hoje" fazia o saldo "atual" informado
 * pelo usuario colidir com lancamentos historicos importados depois, contando o mesmo
 * periodo duas vezes (bug corrigido nesta revisao). `computeAccountBalance` usa essa data
 * como piso: nada anterior a ela e somado de novo.
 */
export class CreateAccountUseCase {
  private readonly database: Database;
  private readonly ids: IdGenerator;

  public constructor(database: Database, ids: IdGenerator) {
    this.database = database;
    this.ids = ids;
  }

  public async execute(rawInput: unknown): Promise<Account> {
    const parsed = createAccountInputSchema.safeParse(rawInput);
    if (!parsed.success) {
      const flat = z.flattenError(parsed.error);
      throw new InvalidInputError('criar conta', flat.fieldErrors, flat.formErrors);
    }

    const input = parsed.data;
    const user = await this.database.users.findById(input.userId);
    if (!user) {
      throw new UserNotFoundError();
    }
    if (!user.isVerified()) {
      throw new UserNotVerifiedError();
    }

    const openingBalanceDate = input.openingBalanceDate != null ? new Date(input.openingBalanceDate) : null;

    const account = Account.create({
      id: this.ids.next(),
      userId: input.userId,
      name: input.name,
      kind: input.kind,
      openingBalance: Money.fromCents(input.openingBalanceCents),
      openingBalanceDate,
      creditLimit: input.creditLimitCents != null ? Money.fromCents(input.creditLimitCents) : null,
      closingDay: input.closingDay ?? null,
      dueDay: input.dueDay ?? null,
      isBenefit: input.isBenefit ?? false,
    });

    if (input.openingBalanceCents <= 0) {
      await this.database.accounts.save(account);
      return account;
    }

    return this.database.transaction(async (tx) => {
      await tx.accounts.save(account);
      const category = await ensureOpeningBalanceCategory(tx.categories, this.ids, input.userId);
      const openingBalanceTransaction = Transaction.create({
        id: this.ids.next(),
        userId: input.userId,
        date: openingBalanceDate as Date,
        amount: Money.fromCents(input.openingBalanceCents),
        type: input.kind === 'credit-card' ? 'expense' : 'income',
        categoryId: category.id,
        accountId: account.id,
        notes: 'Saldo inicial',
      });
      await tx.transactions.save(openingBalanceTransaction);
      return account;
    });
  }
}
