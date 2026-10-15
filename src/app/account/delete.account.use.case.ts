import { z } from 'zod';
import { type Account } from '../../domain/account/account.entity.ts';
import { AccountNotFoundError } from '../../domain/account/account.not.found.error.ts';
import { InvalidInputError } from '../shared/invalid.input.error.ts';
import { type Database } from '../shared/database.port.ts';
import { deleteAccountInputSchema } from './delete.account.input.schema.ts';

/**
 * Caso de uso "excluir conta" (spec 001, RF-1).
 *
 * Busca a conta no escopo do usuario (RF-16) antes de remover, para poder devolver
 * `AccountNotFoundError` quando ela nao existir ou for de outro usuario (CA-14) - o
 * `delete` do repositorio, sozinho, e silencioso nesse caso (idempotente por design).
 * Devolve a conta removida.
 *
 * **Apaga junto os lancamentos da conta (spec 015)**: nao ha `onDelete: Cascade` na FK
 * `Transaction.accountId` (schema Prisma), entao excluir uma conta que ainda tem
 * `Transaction`s vinculadas (por exemplo, a "SALDO INICIAL" que `CreateAccountUseCase` gera
 * automaticamente) falharia com erro de FK. Por isso, dentro da mesma `database.transaction()`,
 * apaga primeiro TODAS as transacoes da conta (nao so as sinteticas) e so entao a conta -
 * excluir a conta remove tudo que so existia por causa dela.
 */
export class DeleteAccountUseCase {
  private readonly database: Database;

  public constructor(database: Database) {
    this.database = database;
  }

  public async execute(rawInput: unknown): Promise<Account> {
    const parsed = deleteAccountInputSchema.safeParse(rawInput);
    if (!parsed.success) {
      const flat = z.flattenError(parsed.error);
      throw new InvalidInputError('excluir conta', flat.fieldErrors, flat.formErrors);
    }

    const input = parsed.data;
    const existing = await this.database.accounts.findById(input.userId, input.id);
    if (!existing) {
      throw new AccountNotFoundError();
    }

    await this.database.transaction(async (tx) => {
      const transactions = await tx.transactions.listByUser(input.userId);
      for (const transaction of transactions) {
        if (transaction.accountId === input.id) {
          await tx.transactions.delete(input.userId, transaction.id);
        }
      }
      await tx.accounts.delete(input.userId, input.id);
    });

    return existing;
  }
}
