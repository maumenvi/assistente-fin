import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MergePossibleDuplicatesUseCase } from '../../../src/app/pre-registration/merge.possible.duplicates.use.case.ts';
import { CreatePreRegistrationFromCaptureUseCase } from '../../../src/app/capture/create.pre.registration.from.capture.use.case.ts';
import { ApprovePreRegistrationUseCase } from '../../../src/app/pre-registration/approve.pre.registration.use.case.ts';
import { FakeDatabase } from '../../../src/database/fake/fake.database.ts';
import { Account } from '../../../src/domain/account/account.entity.ts';
import { CaptureAttachment } from '../../../src/domain/pre-registration/capture.attachment.entity.ts';
import { PreRegistration } from '../../../src/domain/pre-registration/pre.registration.entity.ts';
import { PreRegistrationNotFoundError } from '../../../src/domain/pre-registration/pre.registration.not.found.error.ts';
import { InvalidInputError } from '../../../src/app/shared/invalid.input.error.ts';
import { Money } from '../../../src/domain/shared/money.value.object.ts';
import { User } from '../../../src/domain/user/user.entity.ts';
import { Cpf } from '../../../src/domain/shared/cpf.value.object.ts';
import { Email } from '../../../src/domain/shared/email.value.object.ts';
import { Phone } from '../../../src/domain/shared/phone.value.object.ts';
import { Sha1DeterministicIdGenerator } from '../../../src/libs/id/sha1.deterministic.id.generator.ts';
import { parseWalletNotification } from '../../../src/domain/capture/parse.wallet.notification.ts';
import { type WalletNotification } from '../../../src/domain/capture/wallet.notification.ts';
import { MutableClock } from '../../support/mutable.clock.ts';
import { SequentialIdGenerator } from '../../support/sequential.id.generator.ts';

const T0 = new Date('2026-10-11T16:00:00.000Z');
const at = (minutes: number) => new Date(T0.getTime() + minutes * 60_000);
const pre = (id: string, minutes: number, extra: Partial<Parameters<typeof PreRegistration.create>[0]> = {}) =>
  PreRegistration.create({ id, userId: 'u1', origin: 'wallet', createdAt: at(minutes), ...extra });

function setup() {
  const db = new FakeDatabase();
  const clock = new MutableClock(at(30));
  return { db, clock, merge: new MergePossibleDuplicatesUseCase(db, clock) };
}

test('mantem o mais antigo, completa so os vazios e descarta os outros (com anexos e destino)', async () => {
  const { db, merge } = setup();
  await db.preRegistrations.save(pre('a', 0, { amount: Money.fromCents(1850) }));
  await db.preRegistrations.save(pre('b', 5, { amount: Money.fromCents(9999), description: 'Café do Zé', accountId: 'nubank', possibleDuplicateOf: 'a' }));
  await db.captureAttachments.save(CaptureAttachment.create({ id: 'att', userId: 'u1', preRegistrationId: 'b', kind: 'notification-text', content: 'x', sha256: 'a'.repeat(64), createdAt: at(5) }));

  const survivor = await merge.execute({ userId: 'u1', ids: ['b', 'a'] });

  assert.equal(survivor.id, 'a');
  assert.equal(survivor.amount?.cents, 1850, 'valor existente nao e sobrescrito');
  assert.equal(survivor.description, 'Café do Zé');
  assert.equal(survivor.accountId, 'nubank');
  assert.equal((await db.preRegistrations.listByUser('u1')).length, 1);
  assert.equal(await db.preRegistrations.findById('u1', 'b'), null);
  assert.equal((await db.captureAttachments.listByPreRegistration('u1', 'b')).length, 0);
  assert.equal((await db.preRegistrationOutcomes.find('u1', 'b'))?.outcome, 'discarded');
});

test('trio: fica um so, o mais antigo', async () => {
  const { db, merge } = setup();
  await db.preRegistrations.save(pre('c', 10, { possibleDuplicateOf: 'b' }));
  await db.preRegistrations.save(pre('b', 5, { possibleDuplicateOf: 'a' }));
  await db.preRegistrations.save(pre('a', 0));
  const survivor = await merge.execute({ userId: 'u1', ids: ['c', 'b', 'a'] });
  assert.equal(survivor.id, 'a');
  assert.deepEqual((await db.preRegistrations.listByUser('u1')).map((p) => p.id), ['a']);
});

test('id inexistente: erro de dominio e nada muda', async () => {
  const { db, merge } = setup();
  await db.preRegistrations.save(pre('a', 0));
  await db.preRegistrations.save(pre('b', 5));
  await assert.rejects(merge.execute({ userId: 'u1', ids: ['a', 'b', 'fantasma'] }), PreRegistrationNotFoundError);
  assert.equal((await db.preRegistrations.listByUser('u1')).length, 2);
});

test('entrada invalida: menos de 2 ids ou ids repetidos', async () => {
  const { merge } = setup();
  await assert.rejects(merge.execute({ userId: 'u1', ids: ['a'] }), InvalidInputError);
  await assert.rejects(merge.execute({ userId: 'u1', ids: ['a', 'a'] }), InvalidInputError);
});

test('ponteiro do sobrevivente para um descartado e limpo', async () => {
  const { db, merge } = setup();
  await db.preRegistrations.save(pre('a', 0, { possibleDuplicateOf: 'b' }));
  await db.preRegistrations.save(pre('b', 5));
  const survivor = await merge.execute({ userId: 'u1', ids: ['a', 'b'] });
  assert.equal(survivor.possibleDuplicateOf, null);
});

test('recibos dos descartados passam para o sobrevivente: reentrega de qualquer chave nao recria apos aprovar', async () => {
  const { db, clock, merge } = setup();
  await db.accounts.save(Account.create({ id: 'nubank', userId: 'u1', name: 'Nubank final 4321', kind: 'credit-card', openingBalance: Money.zero() }));
  await db.users.save(User.create({ id: 'u1', cpf: Cpf.create('52998224725'), email: Email.create('m@exemplo.com'), phone: Phone.create('11987654321'), name: 'Marco', createdAt: T0 }).verifyEmail(T0).verifyPhone(T0));
  const capture = new CreatePreRegistrationFromCaptureUseCase(db, new SequentialIdGenerator(), clock);
  const notify = (key: string, minutes: number): WalletNotification => ({
    packageName: 'com.google.android.apps.walletnfcrel',
    notificationKey: key,
    when: at(minutes).getTime(),
    postTime: at(minutes).getTime() + 500,
    title: 'Google Wallet',
    text: 'R$ 18,50 em Café do Zé com Nubank •••• 4321',
  });
  const first = notify('k1', 0);
  const second = notify('k2', 10); // fora da janela: vira outro pre-registro
  clock.set(at(0));
  const a = await capture.execute({ userId: 'u1', draft: parseWalletNotification(first) });
  clock.set(at(10));
  const b = await capture.execute({ userId: 'u1', draft: parseWalletNotification(second) });
  assert.notEqual(a.preRegistration?.id, b.preRegistration?.id);

  const survivor = await merge.execute({ userId: 'u1', ids: [a.preRegistration!.id, b.preRegistration!.id] });
  assert.equal(survivor.id, a.preRegistration?.id);
  assert.equal((await db.captureReceipts.listByPreRegistration('u1', survivor.id)).length, 2);

  await db.preRegistrations.save(survivor.update({ date: T0, paymentMethod: 'credit-card' }));
  await new ApprovePreRegistrationUseCase(db, new Sha1DeterministicIdGenerator(), clock).execute({ userId: 'u1', id: survivor.id, confirmDuplicate: true });
  clock.set(at(11));
  assert.equal((await capture.execute({ userId: 'u1', draft: parseWalletNotification(first) })).decision, 'ignored-resolved');
  assert.equal((await capture.execute({ userId: 'u1', draft: parseWalletNotification(second) })).decision, 'ignored-resolved');
  assert.equal((await db.preRegistrations.listByUser('u1')).length, 0);
});

test('juntar nao faz o sobrevivente parecer editado: a versao da captura acompanha o pre-registro', async () => {
  const { db, clock, merge } = setup();
  await db.accounts.save(Account.create({ id: 'nubank', userId: 'u1', name: 'Nubank final 4321', kind: 'credit-card', openingBalance: Money.zero() }));
  const capture = new CreatePreRegistrationFromCaptureUseCase(db, new SequentialIdGenerator(), clock);
  const notify = (key: string, minutes: number, text: string): WalletNotification => ({
    packageName: 'com.google.android.apps.walletnfcrel',
    notificationKey: key,
    when: at(minutes).getTime(),
    postTime: at(minutes).getTime() + 500,
    title: 'Google Wallet',
    text,
  });
  clock.set(at(0));
  const a = await capture.execute({ userId: 'u1', draft: parseWalletNotification(notify('k1', 0, 'R$ 18,50')) });
  clock.set(at(10));
  const b = await capture.execute({ userId: 'u1', draft: parseWalletNotification(notify('k2', 10, 'R$ 18,50 em Café do Zé com Nubank •••• 4321')) });
  await merge.execute({ userId: 'u1', ids: [a.preRegistration!.id, b.preRegistration!.id] });
  const kept = await db.preRegistrations.findById('u1', a.preRegistration!.id);
  assert.equal(kept?.description, 'Café do Zé');
  const origin = await db.captureReceipts.findByKey('u1', a.preRegistration!.dedupKey!);
  assert.equal(origin?.captureVersion, kept?.updatedAt?.toISOString() ?? null, 'nao conta como edicao do usuario');
});
