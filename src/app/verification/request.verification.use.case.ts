import { z } from 'zod';
import { VerificationCode } from '../../domain/verification/verification.code.entity.ts';
import { UserNotFoundError } from '../../domain/user/user.not.found.error.ts';
import { type IdGenerator } from '../shared/id.generator.port.ts';
import { type Clock } from '../shared/clock.port.ts';
import { type VerificationCodeGenerator } from '../shared/verification.code.generator.port.ts';
import { InvalidInputError } from '../shared/invalid.input.error.ts';
import { type UserRepository } from '../user/user.repository.port.ts';
import { type VerificationCodeRepository } from './verification.code.repository.port.ts';
import { type EmailSender } from './email.sender.port.ts';
import { type SmsSender } from './sms.sender.port.ts';
import { requestVerificationInputSchema } from './request.verification.input.schema.ts';

/** Validade do codigo de verificacao (spec 001, RF-24; questao em aberto 9 da spec). */
const CODE_TTL_MINUTES = 15;

/**
 * Caso de uso "solicitar verificacao de e-mail/telefone" (spec 001, RF-24, RF-25, CA-21).
 *
 * Gera um codigo (via `VerificationCodeGenerator` injetado), persiste com validade de
 * `CODE_TTL_MINUTES` e envia pelo canal certo (`EmailSender` ou `SmsSender`, tambem
 * injetados - RF-25). Nao valida o codigo digitado de volta - isso e
 * `ConfirmVerificationUseCase`.
 */
export class RequestVerificationUseCase {
  private readonly users: UserRepository;
  private readonly verificationCodes: VerificationCodeRepository;
  private readonly ids: IdGenerator;
  private readonly clock: Clock;
  private readonly codes: VerificationCodeGenerator;
  private readonly emailSender: EmailSender;
  private readonly smsSender: SmsSender;

  public constructor(
    users: UserRepository,
    verificationCodes: VerificationCodeRepository,
    ids: IdGenerator,
    clock: Clock,
    codes: VerificationCodeGenerator,
    emailSender: EmailSender,
    smsSender: SmsSender,
  ) {
    this.users = users;
    this.verificationCodes = verificationCodes;
    this.ids = ids;
    this.clock = clock;
    this.codes = codes;
    this.emailSender = emailSender;
    this.smsSender = smsSender;
  }

  public async execute(rawInput: unknown): Promise<void> {
    const parsed = requestVerificationInputSchema.safeParse(rawInput);
    if (!parsed.success) {
      const flat = z.flattenError(parsed.error);
      throw new InvalidInputError('solicitar verificacao', flat.fieldErrors, flat.formErrors);
    }

    const input = parsed.data;
    const user = await this.users.findById(input.userId);
    if (!user) {
      throw new UserNotFoundError();
    }

    const createdAt = this.clock.now();
    const expiresAt = new Date(createdAt.getTime() + CODE_TTL_MINUTES * 60_000);
    const verificationCode = VerificationCode.create({
      id: this.ids.next(),
      userId: user.id,
      channel: input.channel,
      code: this.codes.next(),
      createdAt,
      expiresAt,
    });

    await this.verificationCodes.save(verificationCode);

    if (input.channel === 'email') {
      await this.emailSender.send(user.email, verificationCode.code);
    } else {
      await this.smsSender.send(user.phone, verificationCode.code);
    }
  }
}
