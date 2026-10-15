import { type CaptureReceipt } from '../../domain/pre-registration/capture.receipt.entity.ts';
import { type CaptureReceiptRepository } from '../../app/pre-registration/capture.receipt.repository.port.ts';

/** `CaptureReceiptRepository` em memoria (spec 027). A checagem e a gravacao nao tem `await` no meio. */
export class FakeCaptureReceiptRepository implements CaptureReceiptRepository {
  private readonly byKey = new Map<string, CaptureReceipt>();

  public async insertIfAbsent(receipt: CaptureReceipt): Promise<boolean> {
    const key = `${receipt.userId}|${receipt.captureKey}`;
    if (this.byKey.has(key)) return false;
    this.byKey.set(key, receipt);
    return true;
  }

  public async findByKey(userId: string, captureKey: string): Promise<CaptureReceipt | null> {
    return this.byKey.get(`${userId}|${captureKey}`) ?? null;
  }

  public async findByPreRegistration(userId: string, preRegistrationId: string): Promise<CaptureReceipt | null> {
    return [...this.byKey.values()].find((r) => r.userId === userId && r.preRegistrationId === preRegistrationId) ?? null;
  }

  public async listByPreRegistration(userId: string, preRegistrationId: string): Promise<CaptureReceipt[]> {
    return [...this.byKey.values()]
      .filter((r) => r.userId === userId && r.preRegistrationId === preRegistrationId)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  public async save(receipt: CaptureReceipt): Promise<void> {
    this.byKey.set(`${receipt.userId}|${receipt.captureKey}`, receipt);
  }

  public async purgeResolvedBefore(userId: string, before: Date): Promise<number> {
    let removed = 0;
    for (const [key, r] of this.byKey) {
      if (r.userId === userId && !r.isPending && r.resolvedAt !== null && r.resolvedAt < before) {
        this.byKey.delete(key);
        removed += 1;
      }
    }
    return removed;
  }
}
