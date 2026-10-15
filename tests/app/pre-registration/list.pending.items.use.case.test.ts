import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ListPendingItemsUseCase } from '../../../src/app/pre-registration/list.pending.items.use.case.ts';
import { FakePreRegistrationRepository } from '../../../src/database/fake/pre.registration.repository.fake.ts';
import { PreRegistration } from '../../../src/domain/pre-registration/pre.registration.entity.ts';
import { Money } from '../../../src/domain/shared/money.value.object.ts';

test('agrega pre-registros, capturas para cadastrar e conflitos, com contagens (FR-029)', async () => {
  const repo = new FakePreRegistrationRepository();
  await repo.save(
    PreRegistration.create({ id: 'p1', userId: 'u1', origin: 'voice', createdAt: new Date('2026-09-24T08:00:00Z'), amount: Money.fromCents(14530), description: 'Supermercado' }),
  );
  await repo.save(PreRegistration.create({ id: 'p2', userId: 'u1', origin: 'receipt', createdAt: new Date('2026-09-23T08:00:00Z'), manualOnly: true }));
  const useCase = new ListPendingItemsUseCase(repo, {
    listByUser: async () => [{ id: 'c1', entityLabel: 'Aluguel', detectedAt: new Date('2026-09-24T09:00:00Z') }],
  });
  const result = await useCase.execute({ userId: 'u1' });
  assert.deepEqual(result.items.map((i) => [i.id, i.kind]), [
    ['c1', 'conflict'],
    ['p1', 'pre-registration'],
    ['p2', 'manual'],
  ]);
  assert.deepEqual(result.counts, { all: 3, 'pre-registration': 1, manual: 1, conflict: 1 });
  assert.equal(result.items[1]?.title, 'Supermercado · R$ 145,30');
  assert.deepEqual(result.items[1]?.missing, ['date', 'accountId', 'paymentMethod']);
});

test('sem fonte de conflitos (desktop/independente) lista so pre-registros', async () => {
  const result = await new ListPendingItemsUseCase(new FakePreRegistrationRepository()).execute({ userId: 'u1' });
  assert.equal(result.counts.all, 0);
});

test('spec 027: duplicatas antigas da carteira saem marcadas como possivel duplicata (FR-009)', async () => {
  const repo = new FakePreRegistrationRepository();
  const base = { userId: 'u1', origin: 'wallet' as const, amount: Money.fromCents(4290), description: 'Mercado Dia' };
  await repo.save(PreRegistration.create({ id: 'w1', createdAt: new Date('2026-10-01T12:00:00Z'), ...base }));
  await repo.save(PreRegistration.create({ id: 'w2', createdAt: new Date('2026-10-01T12:00:09Z'), ...base }));
  const result = await new ListPendingItemsUseCase(repo).execute({ userId: 'u1' });
  const flags = Object.fromEntries(result.items.map((i) => [i.id, i.possibleDuplicate]));
  assert.deepEqual(flags, { w1: false, w2: true });
  assert.equal((await repo.findById('u1', 'w2'))?.possibleDuplicateOf, 'w1', 'a marca fica salva');
});

test('spec 028: quem ja respondeu "sao compras diferentes" nao aparece como possivel duplicata nem e remarcado', async () => {
  const repo = new FakePreRegistrationRepository();
  const base = { userId: 'u1', origin: 'wallet' as const, amount: Money.fromCents(4290), description: 'Mercado Dia', duplicateReviewed: true };
  await repo.save(PreRegistration.create({ id: 'w1', createdAt: new Date('2026-10-01T12:00:00Z'), ...base }));
  await repo.save(PreRegistration.create({ id: 'w2', createdAt: new Date('2026-10-01T12:00:09Z'), ...base }));
  const result = await new ListPendingItemsUseCase(repo).execute({ userId: 'u1' });
  assert.deepEqual(result.items.map((i) => i.possibleDuplicate), [false, false]);
  assert.equal((await repo.findById('u1', 'w2'))?.possibleDuplicateOf, null);
});
