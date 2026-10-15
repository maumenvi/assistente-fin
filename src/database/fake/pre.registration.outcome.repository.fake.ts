import { type PreRegistrationOutcome } from '../../domain/pre-registration/pre.registration.outcome.ts';
import { type PreRegistrationOutcomeRepository } from '../../app/pre-registration/pre.registration.outcome.repository.port.ts';

/** `PreRegistrationOutcomeRepository` em memoria (spec 027). */
export class FakePreRegistrationOutcomeRepository implements PreRegistrationOutcomeRepository {
  private readonly byKey = new Map<string, PreRegistrationOutcome>();

  public async record(outcome: PreRegistrationOutcome): Promise<void> {
    this.byKey.set(`${outcome.userId}|${outcome.preRegistrationId}`, outcome);
  }

  public async find(userId: string, preRegistrationId: string): Promise<PreRegistrationOutcome | null> {
    return this.byKey.get(`${userId}|${preRegistrationId}`) ?? null;
  }

  public async purgeBefore(userId: string, before: Date): Promise<number> {
    let removed = 0;
    for (const [key, o] of this.byKey) {
      if (o.userId === userId && o.at < before) {
        this.byKey.delete(key);
        removed += 1;
      }
    }
    return removed;
  }
}
