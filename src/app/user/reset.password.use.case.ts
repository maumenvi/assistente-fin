import { z } from 'zod';
import { type User } from '../../domain/user/user.entity.ts';
import { UserNotFoundError } from '../../domain/user/user.not.found.error.ts';
import { InvalidVerificationCodeError } from '../../domain/verification/invalid.verification.code.error.ts';
import { type Clock } from '../shared/clock.port.ts';
import { InvalidInputError } from '../shared/invalid.input.error.ts';
import { type PasswordHasher } from '../shared/password.hasher.port.ts';
import { type UserRepository } from './user.repository.port.ts';
import { type VerificationCodeRepository } from '../verification/verification.code.repository.port.ts';
import { resetPasswordInputSchema } from './reset.password.input.schema.ts';

/**
 * Caso de uso "redefinir senha por codigo" (spec 002, RF-9b).
 *
 * NAO exige a senha atual. Valida o codigo de verificacao mais recente do canal (mesma
 * logica de `ConfirmVerificationUseCase`: existe, bate, `confirm(now)` reforca prazo/estado
 * - `VerificationCodeExpiredError`/`VerificationCodeAlreadyConfirmedError`), consome o codigo
 * e troca so o hash da senha. NAO mexe na chave de recuperacao (so
 * `ResetPasswordWithRecoveryKey`/`RegenerateRecoveryKey` rotacionam).
 */
export class ResetPasswordUseCase {
  private readonly users: UserRepository;
  private readonly verificationCodes: VerificationCodeRepository;
  private readonly hasher: PasswordHasher;
  private readonly clock: Clock;

  public constructor(
    users: UserRepository,
    verificationCodes: VerificationCodeRepository,
    hasher: PasswordHasher,
    clock: Clock,
  ) {
    this.users = users;
    this.verificationCodes = verificationCodes;
    this.hasher = hasher;
    this.clock = clock;
  }

  public async execute(rawInput: unknown): Promise<User> {
    const parsed = resetPasswordInputSchema.safeParse(rawInput);
    if (!parsed.success) {
      const flat = z.flattenError(parsed.error);
      throw new InvalidInputError('redefinir senha', flat.fieldErrors, flat.formErrors);
    }

    const input = parsed.data;
    const user = await this.users.findById(input.userId);
    if (!user) {
      throw new UserNotFoundError();
    }

    const latest = await this.verificationCodes.findLatestByUserAndChannel(
      input.userId,
      input.channel,
    );
    if (!latest || latest.code !== input.code) {
      throw new InvalidVerificationCodeError('codigo nao confere');
    }

    const now = this.clock.now();
    const consumed = latest.confirm(now);
    await this.verificationCodes.save(consumed);

    const updated = user.setPassword(await this.hasher.hash(input.newPassword));
    await this.users.save(updated);
    return updated;
  }
}
