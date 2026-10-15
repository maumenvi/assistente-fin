import { z } from 'zod';
import { type User } from '../../domain/user/user.entity.ts';
import { UserNotFoundError } from '../../domain/user/user.not.found.error.ts';
import { BadCredentialsError } from '../../domain/user/bad.credentials.error.ts';
import { InvalidInputError } from '../shared/invalid.input.error.ts';
import { type PasswordHasher } from '../shared/password.hasher.port.ts';
import { type UserRepository } from './user.repository.port.ts';
import { authenticateUserInputSchema } from './authenticate.user.input.schema.ts';

/**
 * Caso de uso "autenticar usuario" (spec 002, RF-8, RF-12, CA-8).
 *
 * - Usuario sem senha (`hasPassword() === false`): entra so com o `userId` - a senha
 *   informada, se houver, e ignorada.
 * - Com senha: exige a senha certa (`PasswordHasher.verify`); `BadCredentialsError` quando
 *   falta ou nao confere.
 *
 * Nao mexe em nada - so confirma a identidade. Quem guarda "quem esta logado" e a borda
 * (a sessao do processo Electron).
 */
export class AuthenticateUserUseCase {
  private readonly users: UserRepository;
  private readonly hasher: PasswordHasher;

  public constructor(users: UserRepository, hasher: PasswordHasher) {
    this.users = users;
    this.hasher = hasher;
  }

  public async execute(rawInput: unknown): Promise<User> {
    const parsed = authenticateUserInputSchema.safeParse(rawInput);
    if (!parsed.success) {
      const flat = z.flattenError(parsed.error);
      throw new InvalidInputError('autenticar usuario', flat.fieldErrors, flat.formErrors);
    }

    const input = parsed.data;
    const user = await this.users.findById(input.userId);
    if (!user) {
      throw new UserNotFoundError();
    }

    if (user.passwordHash !== null) {
      if (input.password === undefined) {
        throw new BadCredentialsError();
      }
      if (!(await this.hasher.verify(input.password, user.passwordHash))) {
        throw new BadCredentialsError();
      }
    }

    return user;
  }
}
