import { type VerificationCode } from '../../domain/verification/verification.code.entity.ts';
import { type VerificationChannel } from '../../domain/verification/verification.channel.ts';
import { type VerificationCodeRepository } from '../../app/verification/verification.code.repository.port.ts';

/** Adaptador falso (test double) de `VerificationCodeRepository`, em memoria de processo. */
export class FakeVerificationCodeRepository implements VerificationCodeRepository {
  /** Codigos indexados por id. */
  private readonly byId = new Map<string, VerificationCode>();

  public async save(code: VerificationCode): Promise<void> {
    this.byId.set(code.id, code);
  }

  public async findLatestByUserAndChannel(
    userId: string,
    channel: VerificationChannel,
  ): Promise<VerificationCode | null> {
    let latest: VerificationCode | null = null;
    for (const code of this.byId.values()) {
      if (code.userId !== userId || code.channel !== channel) continue;
      if (!latest || code.createdAt.getTime() > latest.createdAt.getTime()) {
        latest = code;
      }
    }
    return latest;
  }
}
