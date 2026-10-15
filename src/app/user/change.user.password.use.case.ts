import { z } from 'zod';
import { type User } from '../../domain/user/user.entity.ts';
import { UserNotFoundError } from '../../domain/user/user.not.found.error.ts';
import { BadCredentialsError } from '../../domain/user/bad.credentials.error.ts';
import { InvalidInputError } from '../shared/invalid.input.error.ts';
import { type PasswordHasher } from '../shared/password.hasher.port.ts';
import { type UserRepository } from './user.repository.port.ts';
import { changeUserPasswordInputSchema } from './change.user.password.input.schema.ts';

/**
 * Caso de uso "trocar senha" (spec 002, RF-9a).
 *
 * Exige a senha atual correta (`BadCredentialsError` senao - inclusive quando o usuario nao
 * tem senha nenhuma, ai nada confere). NAO mexe na chave de recuperacao - so troca o hash da
 * senha.
 */
export class ChangeUserPasswordUseCase {
  private readonly users: UserRepository;
  private readonly hasher: PasswordHasher;

  public constructor(users: UserRepository, hasher: PasswordHasher) {
    this.users = users;
    this.hasher = hasher;
  }

  public async execute(rawInput: unknown): Promise<User> {
    const parsed = changeUserPasswordInputSchema.safeParse(rawInput);
    if (!parsed.success) {
      const flat = z.flattenError(parsed.error);
      throw new InvalidInputError('trocar senha', flat.fieldErrors, flat.formErrors);
    }

    const input = parsed.data;
    const user = await this.users.findById(input.userId);
    if (!user) {
      throw new UserNotFoundError();
    }

    if (
      user.passwordHash === null ||
      !(await this.hasher.verify(input.currentPassword, user.passwordHash))
    ) {
      throw new BadCredentialsError();
    }

    const updated = user.setPassword(await this.hasher.hash(input.newPassword));
    await this.users.save(updated);
    return updated;
  }
}
