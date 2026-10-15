import { z } from 'zod';
import { type User } from '../../domain/user/user.entity.ts';
import { UserNotFoundError } from '../../domain/user/user.not.found.error.ts';
import { InvalidVerificationCodeError } from '../../domain/verification/invalid.verification.code.error.ts';
import { type Clock } from '../shared/clock.port.ts';
import { InvalidInputError } from '../shared/invalid.input.error.ts';
import { constantTimeEquals } from '../shared/constant.time.equals.ts';
import { type UserRepository } from '../user/user.repository.port.ts';
import { type VerificationCodeRepository } from './verification.code.repository.port.ts';
import { confirmVerificationInputSchema } from './confirm.verification.input.schema.ts';

/**
 * Caso de uso "confirmar verificacao de e-mail/telefone" (spec 001, RF-26, RF-27, CA-22,
 * CA-23).
 *
 * Busca o codigo mais recente do canal e compara com o digitado - `InvalidVerificationCodeError`
 * se nao houver nenhum ou nao bater. `VerificationCode.confirm(now)` reforca as invariantes
 * de tempo/estado (`VerificationCodeExpiredError`, `VerificationCodeAlreadyConfirmedError`).
 * So entao marca o canal do `User` como verificado.
 */
export class ConfirmVerificationUseCase {
  private readonly users: UserRepository;
  private readonly verificationCodes: VerificationCodeRepository;
  private readonly clock: Clock;

  public constructor(
    users: UserRepository,
    verificationCodes: VerificationCodeRepository,
    clock: Clock,
  ) {
    this.users = users;
    this.verificationCodes = verificationCodes;
    this.clock = clock;
  }

  public async execute(rawInput: unknown): Promise<User> {
    const parsed = confirmVerificationInputSchema.safeParse(rawInput);
    if (!parsed.success) {
      const flat = z.flattenError(parsed.error);
      throw new InvalidInputError('confirmar verificacao', flat.fieldErrors, flat.formErrors);
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
    if (!latest || !constantTimeEquals(latest.code, input.code)) {
      throw new InvalidVerificationCodeError('codigo nao confere');
    }

    const now = this.clock.now();
    const confirmed = latest.confirm(now); // VerificationCodeExpiredError / VerificationCodeAlreadyConfirmedError
    await this.verificationCodes.save(confirmed);

    const verifiedUser = input.channel === 'email' ? user.verifyEmail(now) : user.verifyPhone(now);
    await this.users.save(verifiedUser);

    return verifiedUser;
  }
}

