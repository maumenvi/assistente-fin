import { type PairedDevice } from '../../app/sync/paired.device.ts';
import { type PairedDeviceRepository } from '../../app/sync/paired.device.repository.port.ts';

/** Aparelhos pareados em memoria (testes). */
export class FakePairedDeviceRepository implements PairedDeviceRepository {
  private readonly byId = new Map<string, PairedDevice>();

  public async save(device: PairedDevice): Promise<void> {
    this.byId.set(device.id, device);
  }

  public async findById(id: string): Promise<PairedDevice | null> {
    return this.byId.get(id) ?? null;
  }

  public async hasActive(): Promise<boolean> {
    return [...this.byId.values()].some((device) => device.revokedAt === null);
  }

  public async listByUser(userId: string): Promise<PairedDevice[]> {
    return [...this.byId.values()].filter((device) => device.userId === userId);
  }
}
