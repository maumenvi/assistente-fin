import { type BalanceGenerationRepository } from '../../app/dashboard/balance.generation.repository.port.ts';

/** Adaptador falso (test double) de `BalanceGenerationRepository`, com estado em memoria. */
export class FakeBalanceGenerationRepository implements BalanceGenerationRepository {
  private readonly marked = new Set<string>();

  public async existsFor(userId: string, year: number, month: number): Promise<boolean> {
    return this.marked.has(this.key(userId, year, month));
  }

  public async markGenerated(userId: string, year: number, month: number): Promise<void> {
    this.marked.add(this.key(userId, year, month));
  }

  private key(userId: string, year: number, month: number): string {
    return `${userId}:${year}:${month}`;
  }
}
