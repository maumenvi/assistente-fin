import { z } from 'zod';
import { Transaction } from '../../domain/transaction/transaction.entity.ts';
import { Money } from '../../domain/shared/money.value.object.ts';
import { UserNotFoundError } from '../../domain/user/user.not.found.error.ts';
import { UserNotVerifiedError } from '../../domain/user/user.not.verified.error.ts';
import { AccountNotFoundError } from '../../domain/account/account.not.found.error.ts';
import { InvalidCardPaymentAccountsError } from '../../domain/transaction/invalid.card.payment.accounts.error.ts';
import { type Database } from '../shared/database.port.ts';
import { type IdGenerator } from '../shared/id.generator.port.ts';
import { InvalidInputError } from '../shared/invalid.input.error.ts';
import { ensureCardPaymentCategory } from '../category/ensure.card.payment.category.ts';
import { createCardPaymentInputSchema } from './create.card.payment.input.schema.ts';

/** As duas pontas de um pagamento de fatura recem-criado (spec 016, RF-6). */
export interface CardPaymentResult {
  /** Perna de saida, na conta pagadora (`type: 'expense'`). */
  readonly outgoing: Transaction;
  /** Perna de baixa da divida, na conta-cartao (`type: 'income'`, mesmo sinal do saldo inicial). */
  readonly incoming: Transaction;
}

/**
 * Caso de uso "pagar fatura do cartao" (spec 016, RF-6, RF-7).
 *
 * Cartao de credito nao e conta de saldo (decisao de modelo da spec 016) - pagar fatura e
 * uma operacao propria, distinta de transferir entre contas (`CreateTransferUseCase`), com
 * sua propria categoria de sistema (`isSystemCardPayment`, nunca `isSystemTransfer`).
 *
 * Valida usuario verificado e que as duas contas existem e pertencem ao usuario
 * (`AccountNotFoundError`), e que `cardAccountId` e `kind: 'credit-card'` enquanto
 * `payingAccountId` nao e (`InvalidCardPaymentAccountsError` caso contrario).
 *
 * Cria, dentro de `database.transaction()`, com o mesmo `cardPaymentGroupId` novo (RF-6):
 * `expense` na conta pagadora (debita o saldo disponivel) e `income` na conta-cartao - mesmo
 * mecanismo de sinal ja usado pelo saldo inicial de cartao (RF-7): `income` reduz o saldo
 * devedor calculado por `computeAccountBalance`. Grava direto, sem passar por
 * `RecordTransactionUseCase` (mesma razao de `CreateTransferUseCase`/"SALDO INICIAL": e uma
 * transacao sintetica de sistema, nao deve gerar `Income` espelho nem aparecer como ganho).
 */
export class CreateCardPaymentUseCase {
  private readonly database: Database;
  private readonly ids: IdGenerator;

  public constructor(database: Database, ids: IdGenerator) {
    this.database = database;
    this.ids = ids;
  }

  public async execute(rawInput: unknown): Promise<CardPaymentResult> {
    const parsed = createCardPaymentInputSchema.safeParse(rawInput);
    if (!parsed.success) {
      const flat = z.flattenError(parsed.error);
      throw new InvalidInputError('pagar fatura do cartao', flat.fieldErrors, flat.formErrors);
    }

    const input = parsed.data;
    const user = await this.database.users.findById(input.userId);
    if (!user) {
      throw new UserNotFoundError();
    }
    if (!user.isVerified()) {
      throw new UserNotVerifiedError();
    }

    const [payingAccount, cardAccount] = await Promise.all([
      this.database.accounts.findById(input.userId, input.payingAccountId),
      this.database.accounts.findById(input.userId, input.cardAccountId),
    ]);
    if (!payingAccount || !cardAccount) {
      throw new AccountNotFoundError();
    }
    if (cardAccount.kind !== 'credit-card' || payingAccount.kind === 'credit-card') {
      throw new InvalidCardPaymentAccountsError();
    }

    const date = new Date(input.date);
    const amount = Money.fromCents(input.amountCents);

    return this.database.transaction(async (tx) => {
      const category = await ensureCardPaymentCategory(tx.categories, this.ids, input.userId);
      const cardPaymentGroupId = this.ids.next();

      const outgoing = Transaction.create({
        id: this.ids.next(),
        userId: input.userId,
        date,
        amount,
        type: 'expense',
        categoryId: category.id,
        accountId: payingAccount.id,
        notes: input.notes,
        cardPaymentGroupId,
      });
      const incoming = Transaction.create({
        id: this.ids.next(),
        userId: input.userId,
        date,
        amount,
        type: 'income',
        categoryId: category.id,
        accountId: cardAccount.id,
        notes: input.notes,
        cardPaymentGroupId,
      });

      await tx.transactions.save(outgoing);
      await tx.transactions.save(incoming);
      return { outgoing, incoming };
    });
  }
}
