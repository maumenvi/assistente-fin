import { test } from 'node:test';
import assert from 'node:assert/strict';
import { type PreRegistrationOutcomeRepository } from '../../../src/app/pre-registration/pre.registration.outcome.repository.port.ts';

const at = (iso: string) => new Date(iso);

/** Suite de contrato do `PreRegistrationOutcomeRepository` (spec 027, T008). */
export function runPreRegistrationOutcomeRepositoryContract(label: string, createRepository: () => PreRegistrationOutcomeRepository): void {
  test(`${label}: record + find no escopo do usuario; record substitui`, async () => {
    const repo = createRepository();
    await repo.record({ userId: 'u1', preRegistrationId: 'p1', outcome: 'discarded', transactionId: null, at: at('2026-10-01T10:00:00Z') });
    await repo.record({ userId: 'u1', preRegistrationId: 'p1', outcome: 'approved', transactionId: 't1', at: at('2026-10-01T11:00:00Z') });
    const found = await repo.find('u1', 'p1');
    assert.equal(found?.outcome, 'approved');
    assert.equal(found?.transactionId, 't1');
    assert.equal(found?.at.toISOString(), '2026-10-01T11:00:00.000Z');
    assert.equal(await repo.find('u2', 'p1'), null);
  });

  test(`${label}: purgeBefore`, async () => {
    const repo = createRepository();
    await repo.record({ userId: 'u1', preRegistrationId: 'old', outcome: 'approved', transactionId: null, at: at('2026-08-01T00:00:00Z') });
    await repo.record({ userId: 'u1', preRegistrationId: 'new', outcome: 'approved', transactionId: null, at: at('2026-10-01T00:00:00Z') });
    assert.equal(await repo.purgeBefore('u1', at('2026-09-01T00:00:00Z')), 1);
    assert.equal(await repo.find('u1', 'old'), null);
    assert.ok(await repo.find('u1', 'new'));
  });
}
