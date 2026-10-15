import { z } from 'zod';
import { UserNotFoundError } from '../../domain/user/user.not.found.error.ts';
import { BadCredentialsError } from '../../domain/user/bad.credentials.error.ts';
import { InvalidInputError } from '../shared/invalid.input.error.ts';
import { type PasswordHasher } from '../shared/password.hasher.port.ts';
import { type RecoveryKeyGenerator } from '../shared/recovery.key.generator.port.ts';
import { type UserRepository } from './user.repository.port.ts';
import { type RecoveryKeyIssued } from './recovery.key.issued.ts';
import { regenerateRecoveryKeyInputSchema } from './regenerate.recovery.key.input.schema.ts';

/**
 * Caso de uso "gerar nova chave de recuperacao" (spec 002, RF-9d).
 *
 * Exige a senha atual (`BadCredentialsError` senao). Gera uma nova chave, grava o hash e
 * devolve o texto claro - a anterior deixa de valer. Nao mexe na senha.
 */
export class RegenerateRecoveryKeyUseCase {
  private readonly users: UserRepository;
  private readonly hasher: PasswordHasher;
  private readonly recoveryKeys: RecoveryKeyGenerator;

  public constructor(
    users: UserRepository,
    hasher: PasswordHasher,
    recoveryKeys: RecoveryKeyGenerator,
  ) {
    this.users = users;
    this.hasher = hasher;
    this.recoveryKeys = recoveryKeys;
  }

  public async execute(rawInput: unknown): Promise<RecoveryKeyIssued> {
    const parsed = regenerateRecoveryKeyInputSchema.safeParse(rawInput);
    if (!parsed.success) {
      const flat = z.flattenError(parsed.error);
      throw new InvalidInputError('gerar chave de recuperacao', flat.fieldErrors, flat.formErrors);
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

    const recoveryKey = this.recoveryKeys.next();
    const updated = user.setRecoveryKey(await this.hasher.hash(recoveryKey));
    await this.users.save(updated);
    return { user: updated, recoveryKey };
  }
}
