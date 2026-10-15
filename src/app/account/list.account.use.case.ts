import { z } from 'zod';
import { type Account } from '../../domain/account/account.entity.ts';
import { InvalidInputError } from '../shared/invalid.input.error.ts';
import { type AccountRepository } from './account.repository.port.ts';
import { listAccountInputSchema } from './list.account.input.schema.ts';

/** Caso de uso "listar contas" (spec 001, RF-1). Isolamento por usuario e do repositorio (RF-16). */
export class ListAccountsUseCase {
  private readonly accounts: AccountRepository;

  public constructor(accounts: AccountRepository) {
    this.accounts = accounts;
  }

  public async execute(rawInput: unknown): Promise<Account[]> {
    const parsed = listAccountInputSchema.safeParse(rawInput);
    if (!parsed.success) {
      const flat = z.flattenError(parsed.error);
      throw new InvalidInputError('listar contas', flat.fieldErrors, flat.formErrors);
    }

    return this.accounts.listByUser(parsed.data.userId);
  }
}
