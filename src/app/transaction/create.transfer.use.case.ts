import { z } from 'zod';
import { Transaction } from '../../domain/transaction/transaction.entity.ts';
import { Money } from '../../domain/shared/money.value.object.ts';
import { UserNotFoundError } from '../../domain/user/user.not.found.error.ts';
import { UserNotVerifiedError } from '../../domain/user/user.not.verified.error.ts';
import { AccountNotFoundError } from '../../domain/account/account.not.found.error.ts';
import { CreditCardNotAllowedInTransferError } from '../../domain/transaction/credit.card.not.allowed.in.transfer.error.ts';
import { DuplicateTransferError } from '../../domain/transaction/duplicate.transfer.error.ts';
import { type Database } from '../shared/database.port.ts';
import { type IdGenerator } from '../shared/id.generator.port.ts';
import { InvalidInputError } from '../shared/invalid.input.error.ts';
import { ensureTransferCategory } from '../category/ensure.transfer.category.ts';
import { createTransferInputSchema } from './create.transfer.input.schema.ts';

/** As duas pontas de uma transferencia recem-criada (spec 016, RF-3). */
export interface TransferResult {
  /** Perna de saida, na conta de origem (`type: 'expense'`). */
  readonly outgoing: Transaction;
  /** Perna de entrada, na conta de destino (`type: 'income'`). */
  readonly incoming: Transaction;
}

/**
 * Caso de uso "transferir entre contas" (spec 016, RF-3, RF-4, RF-5).
 *
 * Valida usuario verificado (mesmo padrao de `CreateAccountUseCase`) e que as duas contas
 * existem e pertencem ao usuario (`AccountNotFoundError`). Rejeita `fromAccountId ===
 * toAccountId` (checagem de fronteira, nao invariante de dominio) e rejeita qualquer conta
 * de cartao de credito como origem ou destino (`CreditCardNotAllowedInTransferError`, RF-4) -
 * cartao nao e conta de saldo, decisao de modelo desta spec.
 *
 * Cria as duas `Transaction`s (saida `expense` na origem, entrada `income` no destino, mesmo
 * valor/data/categoria) dentro de `database.transaction()`, com o mesmo `transferGroupId`
 * novo (RF-5) - mesma atomicidade de `CreateAccountUseCase`/`ReconcileAccountBalanceUseCase`.
 * Grava direto (`tx.transactions.save`), sem passar por `RecordTransactionUseCase`: essa e
 * uma transacao sintetica de sistema (categoria `isSystemTransfer`), nao deve gerar o
 * `Income` espelho que `RecordTransactionUseCase` cria para todo `type: income` manual (spec
 * 012, RF-5) - mesma razao pela qual "SALDO INICIAL" tambem grava direto.
 *
 * A categoria vem de `ensureTransferCategory`, que promove uma categoria "TRANSFERÊNCIAS" ja
 * existente do usuario (criada manualmente antes desta spec) em vez de tentar criar uma
 * segunda com o mesmo nome - sem isso, o `@@unique([userId, name])` do Postgres rejeitava a
 * criacao com um erro de constraint que virava `INTERNAL` na borda MCP (nao era um
 * `DomainError`). Antes de gravar, tambem rejeita uma transferencia identica ja persistida
 * (`DuplicateTransferError`, mesma origem/destino/valor/dia das duas pernas) - previne dupla
 * submissao sem depender de o driver de banco reportar a colisao.
 */
export class CreateTransferUseCase {
  private readonly database: Database;
  private readonly ids: IdGenerator;

  public constructor(database: Database, ids: IdGenerator) {
    this.database = database;
    this.ids = ids;
  }

  public async execute(rawInput: unknown): Promise<TransferResult> {
    const parsed = createTransferInputSchema.safeParse(rawInput);
    if (!parsed.success) {
      const flat = z.flattenError(parsed.error);
      throw new InvalidInputError('transferir entre contas', flat.fieldErrors, flat.formErrors);
    }

    const input = parsed.data;
    const user = await this.database.users.findById(input.userId);
    if (!user) {
      throw new UserNotFoundError();
    }
    if (!user.isVerified()) {
      throw new UserNotVerifiedError();
    }

    if (input.fromAccountId === input.toAccountId) {
      throw new InvalidInputError('transferir entre contas', {}, [
        'fromAccountId e toAccountId nao podem ser a mesma conta',
      ]);
    }

    const [fromAccount, toAccount] = await Promise.all([
      this.database.accounts.findById(input.userId, input.fromAccountId),
      this.database.accounts.findById(input.userId, input.toAccountId),
    ]);
    if (!fromAccount || !toAccount) {
      throw new AccountNotFoundError();
    }
    if (fromAccount.kind === 'credit-card' || toAccount.kind === 'credit-card') {
      throw new CreditCardNotAllowedInTransferError();
    }

    const date = new Date(input.date);
    const amount = Money.fromCents(input.amountCents);

    return this.database.transaction(async (tx) => {
      const category = await ensureTransferCategory(tx.categories, this.ids, input.userId);
      const transferGroupId = this.ids.next();

      const outgoing = Transaction.create({
        id: this.ids.next(),
        userId: input.userId,
        date,
        amount,
        type: 'expense',
        categoryId: category.id,
        accountId: fromAccount.id,
        notes: input.notes,
        transferGroupId,
      });
      const incoming = Transaction.create({
        id: this.ids.next(),
        userId: input.userId,
        date,
        amount,
        type: 'income',
        categoryId: category.id,
        accountId: toAccount.id,
        notes: input.notes,
        transferGroupId,
      });

      // Deduplicacao: mesma origem/destino/valor/dia ja persistidos vira DuplicateTransferError,
      // nunca um retry silencioso nem um INTERNAL de constraint (RF-3, criterio de aceite 7).
      const [duplicateOutgoing, duplicateIncoming] = await Promise.all([
        tx.transactions.findDuplicate(outgoing),
        tx.transactions.findDuplicate(incoming),
      ]);
      if (duplicateOutgoing && duplicateIncoming && duplicateOutgoing.transferGroupId === duplicateIncoming.transferGroupId) {
        throw new DuplicateTransferError();
      }

      await tx.transactions.save(outgoing);
      await tx.transactions.save(incoming);
      return { outgoing, incoming };
    });
  }
}
