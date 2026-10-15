import { z } from 'zod';
import { UserNotFoundError } from '../../domain/user/user.not.found.error.ts';
import { PasswordAlreadySetError } from '../../domain/user/password.already.set.error.ts';
import { InvalidInputError } from '../shared/invalid.input.error.ts';
import { type PasswordHasher } from '../shared/password.hasher.port.ts';
import { type RecoveryKeyGenerator } from '../shared/recovery.key.generator.port.ts';
import { type UserRepository } from './user.repository.port.ts';
import { type RecoveryKeyIssued } from './recovery.key.issued.ts';
import { setUserPasswordInputSchema } from './set.user.password.input.schema.ts';

/**
 * Caso de uso "definir senha" (spec 002, RF-9, RF-9c).
 *
 * So DEFINE quando o usuario ainda nao tem senha (`PasswordAlreadySetError` senao - trocar e
 * `ChangeUserPassword`). Ao definir, gera a primeira chave de recuperacao de conta, grava so
 * o hash dela e devolve o texto claro uma unica vez.
 */
export class SetUserPasswordUseCase {
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
    const parsed = setUserPasswordInputSchema.safeParse(rawInput);
    if (!parsed.success) {
      const flat = z.flattenError(parsed.error);
      throw new InvalidInputError('definir senha', flat.fieldErrors, flat.formErrors);
    }

    const input = parsed.data;
    const user = await this.users.findById(input.userId);
    if (!user) {
      throw new UserNotFoundError();
    }
    if (user.hasPassword()) {
      throw new PasswordAlreadySetError();
    }

    const recoveryKey = this.recoveryKeys.next();
    const [passwordHash, recoveryKeyHash] = await Promise.all([
      this.hasher.hash(input.password),
      this.hasher.hash(recoveryKey),
    ]);

    const updated = user.setPassword(passwordHash).setRecoveryKey(recoveryKeyHash);
    await this.users.save(updated);
    return { user: updated, recoveryKey };
  }
}
