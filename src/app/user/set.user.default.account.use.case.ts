import { z } from 'zod';
import { type User } from '../../domain/user/user.entity.ts';
import { UserNotFoundError } from '../../domain/user/user.not.found.error.ts';
import { AccountNotFoundError } from '../../domain/account/account.not.found.error.ts';
import { AccountArchivedError } from '../../domain/account/account.archived.error.ts';
import { InvalidInputError } from '../shared/invalid.input.error.ts';
import { type AccountRepository } from '../account/account.repository.port.ts';
import { type UserRepository } from './user.repository.port.ts';
import { setUserDefaultAccountInputSchema } from './set.user.default.account.input.schema.ts';

/**
 * Caso de uso "definir conta padrao para lancamentos" (spec 007, RF-3, RF-4, RF-5).
 *
 * `accountId` nulo limpa a preferencia (RF-4). Quando informado, valida que a conta existe e
 * pertence ao mesmo usuario (`AccountNotFoundError`, mesma semantica de isolamento de
 * `RecordTransactionUseCase`/`UpdateTransactionUseCase`, RF-16) e que nao esta arquivada
 * (`AccountArchivedError`, reaproveitada da spec 005 - CA-10) - so contas ativas podem virar
 * padrao (RF-3).
 */
export class SetUserDefaultAccountUseCase {
  private readonly users: UserRepository;
  private readonly accounts: AccountRepository;

  public constructor(users: UserRepository, accounts: AccountRepository) {
    this.users = users;
    this.accounts = accounts;
  }

  public async execute(rawInput: unknown): Promise<User> {
    const parsed = setUserDefaultAccountInputSchema.safeParse(rawInput);
    if (!parsed.success) {
      const flat = z.flattenError(parsed.error);
      throw new InvalidInputError('definir conta padrao', flat.fieldErrors, flat.formErrors);
    }

    const input = parsed.data;
    const user = await this.users.findById(input.userId);
    if (!user) {
      throw new UserNotFoundError();
    }

    if (input.accountId !== null) {
      const account = await this.accounts.findById(input.userId, input.accountId);
      if (!account) {
        throw new AccountNotFoundError();
      }
      if (account.archived) {
        throw new AccountArchivedError();
      }
    }

    const updated = user.setDefaultAccount(input.accountId);
    await this.users.save(updated);
    return updated;
  }
}
