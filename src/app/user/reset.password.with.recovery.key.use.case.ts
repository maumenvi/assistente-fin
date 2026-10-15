import { z } from 'zod';
import { UserNotFoundError } from '../../domain/user/user.not.found.error.ts';
import { BadRecoveryKeyError } from '../../domain/user/bad.recovery.key.error.ts';
import { InvalidInputError } from '../shared/invalid.input.error.ts';
import { type PasswordHasher } from '../shared/password.hasher.port.ts';
import { type RecoveryKeyGenerator } from '../shared/recovery.key.generator.port.ts';
import { type UserRepository } from './user.repository.port.ts';
import { type RecoveryKeyIssued } from './recovery.key.issued.ts';
import { resetPasswordWithRecoveryKeyInputSchema } from './reset.password.with.recovery.key.input.schema.ts';

/**
 * Caso de uso "redefinir senha com a chave de recuperacao" (spec 002, RF-9b, RF-9c).
 *
 * NAO exige a senha atual nem canal. Confere a chave contra `recoveryKeyHash`
 * (`BadRecoveryKeyError` senao). Em caso de sucesso troca a senha E rotaciona a chave (uso
 * unico): gera uma nova, grava o hash dela e devolve o texto claro da NOVA chave.
 */
export class ResetPasswordWithRecoveryKeyUseCase {
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
    const parsed = resetPasswordWithRecoveryKeyInputSchema.safeParse(rawInput);
    if (!parsed.success) {
      const flat = z.flattenError(parsed.error);
      throw new InvalidInputError('redefinir senha com chave', flat.fieldErrors, flat.formErrors);
    }

    const input = parsed.data;
    const user = await this.users.findById(input.userId);
    if (!user) {
      throw new UserNotFoundError();
    }

    if (
      user.recoveryKeyHash === null ||
      !(await this.hasher.verify(input.recoveryKey, user.recoveryKeyHash))
    ) {
      throw new BadRecoveryKeyError();
    }

    const nextRecoveryKey = this.recoveryKeys.next();
    const [passwordHash, recoveryKeyHash] = await Promise.all([
      this.hasher.hash(input.newPassword),
      this.hasher.hash(nextRecoveryKey),
    ]);

    const updated = user.setPassword(passwordHash).setRecoveryKey(recoveryKeyHash);
    await this.users.save(updated);
    return { user: updated, recoveryKey: nextRecoveryKey };
  }
}
