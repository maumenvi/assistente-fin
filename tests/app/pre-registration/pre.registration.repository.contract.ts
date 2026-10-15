import { test } from 'node:test';
import assert from 'node:assert/strict';
import { type PreRegistrationRepository } from '../../../src/app/pre-registration/pre.registration.repository.port.ts';
import { PreRegistration } from '../../../src/domain/pre-registration/pre.registration.entity.ts';
import { Money } from '../../../src/domain/shared/money.value.object.ts';
import { StaleDataError } from '../../../src/app/shared/stale.data.error.ts';

const pre = (id: string, userId: string, createdAt: string, extra: Partial<Parameters<typeof PreRegistration.create>[0]> = {}) =>
  PreRegistration.create({ id, userId, origin: 'manual', createdAt: new Date(createdAt), ...extra });

/** Suite de contrato do `PreRegistrationRepository` (spec 022, T047). */
export function runPreRegistrationRepositoryContract(label: string, createRepository: () => PreRegistrationRepository): void {
  test(`${label}: save + findById no escopo do usuario, com todas as props`, async () => {
    const repo = createRepository();
    await repo.save(
      pre('p1', 'u1', '2026-09-24T10:00:00Z', {
        amount: Money.fromCents(14530),
        paymentMethod: 'credit-card',
        installments: 2,
        accountId: 'iti',
        dedupKey: 'k1',
        possibleDuplicateOf: 't1',
        sourceDevice: 'Pixel',
        notes: 'https://sefaz/qr',
        needsReview: true,
      }),
    );
    const found = await repo.findById('u1', 'p1');
    assert.equal(found?.amount?.cents, 14530);
    assert.equal(found?.installments, 2);
    assert.equal(found?.needsReview, true);
    assert.equal(found?.possibleDuplicateOf, 't1');
    assert.equal(await repo.findById('u2', 'p1'), null);
  });

  test(`${label}: duplicateReviewed vai e volta (spec 028)`, async () => {
    const repo = createRepository();
    await repo.save(pre('r1', 'u1', '2026-09-24T10:00:00Z', { possibleDuplicateOf: 'x', duplicateReviewed: true }));
    await repo.save(pre('r2', 'u1', '2026-09-24T11:00:00Z'));
    const reviewed = await repo.findById('u1', 'r1');
    assert.equal(reviewed?.duplicateReviewed, true);
    assert.equal(reviewed?.possibleDuplicateOf, null);
    assert.equal((await repo.findById('u1', 'r2'))?.duplicateReviewed, false);
  });

  test(`${label}: listByUser mais recentes primeiro e countPending`, async () => {
    const repo = createRepository();
    await repo.save(pre('a', 'u1', '2026-09-20T10:00:00Z'));
    await repo.save(pre('b', 'u1', '2026-09-24T10:00:00Z'));
    await repo.save(pre('c', 'u2', '2026-09-24T10:00:00Z'));
    assert.deepEqual((await repo.listByUser('u1')).map((p) => p.id), ['b', 'a']);
    assert.equal(await repo.countPending('u1'), 2);
  });

  test(`${label}: dedupKey nao e unica`, async () => {
    const repo = createRepository();
    await repo.save(pre('a', 'u1', '2026-09-20T10:00:00Z', { dedupKey: 'nota-1' }));
    await repo.save(pre('b', 'u1', '2026-09-21T10:00:00Z', { dedupKey: 'nota-1' }));
    assert.equal((await repo.findByDedupKey('u1', 'nota-1')).length, 2);
    assert.equal((await repo.findByDedupKey('u2', 'nota-1')).length, 0);
  });

  test(`${label}: trava otimista e delete no escopo do usuario`, async () => {
    const repo = createRepository();
    await repo.save(pre('a', 'u1', '2026-09-20T10:00:00Z'));
    const read = await repo.findById('u1', 'a');
    assert.ok(read);
    await repo.save(read.update({ description: 'editado' }));
    await assert.rejects(repo.save(read.update({ description: 'outra' })), StaleDataError);
    await repo.delete('u2', 'a');
    assert.ok(await repo.findById('u1', 'a'));
    await repo.delete('u1', 'a');
    assert.equal(await repo.findById('u1', 'a'), null);
  });
}
