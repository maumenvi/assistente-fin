import { z } from 'zod';
import { type User } from '../../domain/user/user.entity.ts';
import { UserNotFoundError } from '../../domain/user/user.not.found.error.ts';
import { InvalidInputError } from '../shared/invalid.input.error.ts';
import { type UserRepository } from './user.repository.port.ts';
import { removeUserPasswordInputSchema } from './remove.user.password.input.schema.ts';

/**
 * Caso de uso "remover senha" (spec 002, RF-9).
 *
 * Tira a trava de acesso: limpa o hash da senha E o da chave de recuperacao (andam juntos).
 * Idempotente - remover de um usuario sem senha nao faz nada e nao lanca. O usuario ja esta
 * autenticado na sessao, entao nao pede a senha atual.
 */
export class RemoveUserPasswordUseCase {
  private readonly users: UserRepository;

  public constructor(users: UserRepository) {
    this.users = users;
  }

  public async execute(rawInput: unknown): Promise<User> {
    const parsed = removeUserPasswordInputSchema.safeParse(rawInput);
    if (!parsed.success) {
      const flat = z.flattenError(parsed.error);
      throw new InvalidInputError('remover senha', flat.fieldErrors, flat.formErrors);
    }

    const user = await this.users.findById(parsed.data.userId);
    if (!user) {
      throw new UserNotFoundError();
    }

    if (!user.hasPassword()) {
      return user;
    }

    const updated = user.removePassword();
    await this.users.save(updated);
    return updated;
  }
}
