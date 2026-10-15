import { type VerificationCode } from '../../domain/verification/verification.code.entity.ts';
import { type VerificationChannel } from '../../domain/verification/verification.channel.ts';

/**
 * Porta de persistencia de codigos de verificacao (spec 001, RF-24..RF-27).
 *
 * `findLatestByUserAndChannel` e o que `ConfirmVerificationUseCase` usa pra achar o codigo
 * que o usuario deveria estar confirmando - o mais recente solicitado pra aquele canal.
 */
export interface VerificationCodeRepository {
  /** Insere ou atualiza o codigo (chave: `verificationCode.id`). */
  save(code: VerificationCode): Promise<void>;

  /** Codigo mais recente do usuario para o canal. `null` se nunca foi solicitado. */
  findLatestByUserAndChannel(
    userId: string,
    channel: VerificationChannel,
  ): Promise<VerificationCode | null>;
}
