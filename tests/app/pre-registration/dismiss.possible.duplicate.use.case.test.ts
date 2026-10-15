import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DismissPossibleDuplicateUseCase } from '../../../src/app/pre-registration/dismiss.possible.duplicate.use.case.ts';
import { ApprovePreRegistrationUseCase } from '../../../src/app/pre-registration/approve.pre.registration.use.case.ts';
import { ListPendingItemsUseCase } from '../../../src/app/pre-registration/list.pending.items.use.case.ts';
import { FakeDatabase } from '../../../src/database/fake/fake.database.ts';
import { Account } from '../../../src/domain/account/account.entity.ts';
import { PreRegistration } from '../../../src/domain/pre-registration/pre.registration.entity.ts';
import { PreRegistrationNotFoundError } from '../../../src/domain/pre-registration/pre.registration.not.found.error.ts';
import { PossibleDuplicateError } from '../../../src/domain/pre-registration/possible.duplicate.error.ts';
import { groupPossibleDuplicates } from '../../../src/domain/pre-registration/group.possible.duplicates.ts';
import { Transaction } from '../../../src/domain/transaction/transaction.entity.ts';
import { Money } from '../../../src/domain/shared/money.value.object.ts';
import { User } from '../../../src/domain/user/user.entity.ts';
import { Cpf } from '../../../src/domain/shared/cpf.value.object.ts';
import { Email } from '../../../src/domain/shared/email.value.object.ts';
import { Phone } from '../../../src/domain/shared/phone.value.object.ts';
import { Sha1DeterministicIdGenerator } from '../../../src/libs/id/sha1.deterministic.id.generator.ts';
import { FixedClock } from '../../support/fixed.clock.ts';

const T0 = new Date('2026-10-11T16:00:00.000Z');
const at = (minutes: number) => new Date(T0.getTime() + minutes * 60_000);
const pre = (id: string, minutes: number, extra: Partial<Parameters<typeof PreRegistration.create>[0]> = {}) =>
  PreRegistration.create({ id, userId: 'u1', origin: 'wallet', createdAt: at(minutes), amount: Money.fromCents(1850), description: 'Café do Zé', ...extra });

test('"sao diferentes" num par: os dois ficam revisados, sem marca, e saem do agrupamento', async () => {
  const db = new FakeDatabase();
  await db.preRegistrations.save(pre('a', 0));
  await db.preRegistrations.save(pre('b', 5, { possibleDuplicateOf: 'a' }));
  const result = await new DismissPossibleDuplicateUseCase(db).execute({ userId: 'u1', ids: ['a', 'b'] });
  assert.deepEqual(result.map((p) => p.duplicateReviewed), [true, true]);
  const pending = await db.preRegistrations.listByUser('u1');
  assert.equal(pending.every((p) => p.possibleDuplicateOf === null), true);
  assert.deepEqual(groupPossibleDuplicates(pending), []);
});

test('"este e diferente" num trio: os outros dois continuam agrupados', async () => {
  const db = new FakeDatabase();
  await db.preRegistrations.save(pre('a', 0));
  await db.preRegistrations.save(pre('b', 5, { possibleDuplicateOf: 'a' }));
  await db.preRegistrations.save(pre('c', 10, { possibleDuplicateOf: 'a' }));
  await new DismissPossibleDuplicateUseCase(db).execute({ userId: 'u1', ids: ['c'] });
  const groups = groupPossibleDuplicates(await db.preRegistrations.listByUser('u1'));
  assert.deepEqual(groups.map((g) => g.members.map((m) => m.id)), [['a', 'b']]);
});

test('"este e diferente" num par: o outro fica sem ponteiro pendurado', async () => {
  const db = new FakeDatabase();
  await db.preRegistrations.save(pre('a', 0));
  await db.preRegistrations.save(pre('b', 5, { possibleDuplicateOf: 'a' }));
  await new DismissPossibleDuplicateUseCase(db).execute({ userId: 'u1', ids: ['a'] });
  assert.equal((await db.preRegistrations.findById('u1', 'b'))?.possibleDuplicateOf, null);
});

test('o marcador legado da lista nao remarca quem foi revisado', async () => {
  const db = new FakeDatabase();
  await db.preRegistrations.save(pre('a', 0));
  await db.preRegistrations.save(pre('b', 1));
  const list = new ListPendingItemsUseCase(db.preRegistrations);
  assert.equal((await list.execute({ userId: 'u1' })).items.filter((i) => i.possibleDuplicate).length, 1, 'antes: remarcado');
  await db.preRegistrations.save((await db.preRegistrations.findById('u1', 'b'))!.update({ possibleDuplicateOf: null }));
  await new DismissPossibleDuplicateUseCase(db).execute({ userId: 'u1', ids: ['a', 'b'] });
  assert.equal((await list.execute({ userId: 'u1' })).items.filter((i) => i.possibleDuplicate).length, 0);
});

test('aprovar depois nao repete o aviso do par, mas ainda avisa de lancamento igual (FR-019)', async () => {
  const db = new FakeDatabase();
  const clock = new FixedClock(at(30));
  await db.accounts.save(Account.create({ id: 'itau', userId: 'u1', name: 'Itaú', kind: 'checking', openingBalance: Money.zero() }));
  await db.users.save(User.create({ id: 'u1', cpf: Cpf.create('52998224725'), email: Email.create('m@exemplo.com'), phone: Phone.create('11987654321'), name: 'Marco', createdAt: T0 }).verifyEmail(T0).verifyPhone(T0));
  const complete = { date: T0, accountId: 'itau', paymentMethod: 'pix' as const };
  await db.preRegistrations.save(pre('a', 0, complete));
  await db.preRegistrations.save(pre('b', 5, { ...complete, possibleDuplicateOf: 'a' }));
  const approve = new ApprovePreRegistrationUseCase(db, new Sha1DeterministicIdGenerator(), clock);
  await assert.rejects(approve.execute({ userId: 'u1', id: 'b' }), PossibleDuplicateError, 'antes de responder: avisa');

  await new DismissPossibleDuplicateUseCase(db).execute({ userId: 'u1', ids: ['a', 'b'] });
  await approve.execute({ userId: 'u1', id: 'a' });
  await db.transactions.save(Transaction.create({ id: 't1', userId: 'u1', date: T0, amount: Money.fromCents(1850), type: 'expense', categoryId: 'c', accountId: 'itau' }));
  await assert.rejects(approve.execute({ userId: 'u1', id: 'b' }), PossibleDuplicateError, 'lancamento igual no mesmo dia continua avisando');
});

test('id inexistente: erro de dominio', async () => {
  const db = new FakeDatabase();
  await assert.rejects(new DismissPossibleDuplicateUseCase(db).execute({ userId: 'u1', ids: ['fantasma'] }), PreRegistrationNotFoundError);
});
