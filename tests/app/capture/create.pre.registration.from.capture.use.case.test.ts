import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CreatePreRegistrationFromCaptureUseCase } from '../../../src/app/capture/create.pre.registration.from.capture.use.case.ts';
import { FakeDatabase } from '../../../src/database/fake/fake.database.ts';
import { Account } from '../../../src/domain/account/account.entity.ts';
import { Transaction } from '../../../src/domain/transaction/transaction.entity.ts';
import { Money } from '../../../src/domain/shared/money.value.object.ts';
import { FixedClock } from '../../support/fixed.clock.ts';
import { SequentialIdGenerator } from '../../support/sequential.id.generator.ts';
import { parseWalletNotification } from '../../../src/domain/capture/parse.wallet.notification.ts';
import { type WalletNotification } from '../../../src/domain/capture/wallet.notification.ts';
import { User } from '../../../src/domain/user/user.entity.ts';
import { Cpf } from '../../../src/domain/shared/cpf.value.object.ts';
import { Email } from '../../../src/domain/shared/email.value.object.ts';
import { Phone } from '../../../src/domain/shared/phone.value.object.ts';
import { Sha1DeterministicIdGenerator } from '../../../src/libs/id/sha1.deterministic.id.generator.ts';
import { ApprovePreRegistrationUseCase } from '../../../src/app/pre-registration/approve.pre.registration.use.case.ts';
import { DiscardPreRegistrationUseCase } from '../../../src/app/pre-registration/discard.pre.registration.use.case.ts';

const NOW = new Date('2026-09-24T12:00:00.000Z');

async function setup() {
  const db = new FakeDatabase();
  await db.accounts.save(Account.create({ id: 'iti', userId: 'u1', name: 'Iti', kind: 'credit-card', openingBalance: Money.zero() }));
  const ids = new SequentialIdGenerator();
  const clock = new FixedClock(NOW);
  return { db, useCase: new CreatePreRegistrationFromCaptureUseCase(db, ids, clock) };
}

test('resolve a conta citada, guarda o anexo e marca "conferir" com baixa confianca', async () => {
  const { db, useCase } = await setup();
  const { preRegistration: pre } = await useCase.execute({
    userId: 'u1',
    draft: { origin: 'voice', amountCents: 14530, description: 'supermercado', accountHint: 'iti', paymentMethod: 'credit-card', installments: 2, confidence: 'low' },
    attachments: [{ kind: 'speech-text', content: 'fiz compra no supermercado', sha256: 'd'.repeat(64) }],
  });
  assert.equal(pre?.accountId, 'iti');
  assert.equal(pre?.installments, 2);
  assert.equal(pre?.needsReview, true);
  assert.equal((await db.captureAttachments.listByPreRegistration('u1', pre!.id)).length, 1);
});

test('nota ja lancada: marca possivel duplicata pelo link, sem bloquear (FR-027)', async () => {
  const { db, useCase } = await setup();
  await db.transactions.save(
    Transaction.create({ id: 't1', userId: 'u1', date: NOW, amount: Money.fromCents(21248), type: 'expense', categoryId: 'c', accountId: 'iti', notes: 'https://sefaz/qr?p=CHAVE' }),
  );
  const { preRegistration: pre } = await useCase.execute({
    userId: 'u1',
    draft: { origin: 'nfce', notes: 'https://sefaz/qr?p=CHAVE', link: 'https://sefaz/qr?p=CHAVE', dedupKey: 'CHAVE', confidence: 'low' },
  });
  assert.equal(pre?.possibleDuplicateOf, 't1');
});

test('captura sem nada util vira cadastro manual; mesma notificacao duas vezes nao duplica', async () => {
  const { db, useCase } = await setup();
  const { preRegistration: manual } = await useCase.execute({
    userId: 'u1',
    draft: { origin: 'receipt', confidence: 'low' },
    attachments: [{ kind: 'image', mimeType: 'image/jpeg', fileRef: 'file:///a.jpg', sha256: 'e'.repeat(64) }],
  });
  assert.equal(manual?.manualOnly, true);
  const draft = { origin: 'wallet' as const, amountCents: 18000, description: 'Posto', dedupKey: 'hash-1', confidence: 'high' as const };
  const first = await useCase.execute({ userId: 'u1', draft });
  const second = await useCase.execute({ userId: 'u1', draft });
  assert.equal(second.preRegistration?.id, first.preRegistration?.id);
  assert.equal(second.decision, 'filled');
  assert.equal((await db.preRegistrations.listByUser('u1')).length, 2);
});

// ---- spec 027 (T014): reproducao da duplicacao pela atualizacao da mesma notificacao ----

const WALLET = 'com.google.android.apps.walletnfcrel';
/** Mesma compra: a carteira posta generico e depois atualiza com o estabelecimento (postTime muda). */
const posted = { packageName: WALLET, notificationKey: '0|wallet|7|null|10123', when: Date.parse('2026-09-24T11:59:00Z'), postTime: Date.parse('2026-09-24T11:59:01Z'), title: 'Google Wallet', text: 'R$ 42,90 com Nubank •••• 1234' } as WalletNotification;
const updated = { ...posted, postTime: Date.parse('2026-09-24T11:59:09Z'), title: 'Mercado Dia', text: 'R$ 42,90 com Nubank •••• 1234' } as WalletNotification;

async function capture(useCase: CreatePreRegistrationFromCaptureUseCase, notification: WalletNotification) {
  return useCase.execute({ userId: 'u1', draft: parseWalletNotification(notification) });
}

test('spec 027: postagem + atualizacao da mesma notificacao = um unico pre-registro, completado', async () => {
  const { db, useCase } = await setup();
  await capture(useCase, posted);
  await capture(useCase, updated);
  const pres = await db.preRegistrations.listByUser('u1');
  assert.equal(pres.length, 1);
  assert.equal(pres[0]?.description, 'Mercado Dia');
});

test('spec 027: pre-registro ja editado pelo usuario nao e alterado pela atualizacao (C1-b)', async () => {
  const { db, useCase } = await setup();
  await capture(useCase, { ...posted, title: 'Google Wallet', text: 'R$ 42,90' } as WalletNotification);
  const [pre] = await db.preRegistrations.listByUser('u1');
  await db.preRegistrations.save(pre!.update({ notes: 'editado a mao' }));
  await capture(useCase, updated);
  const pres = await db.preRegistrations.listByUser('u1');
  assert.equal(pres.length, 1);
  assert.equal(pres[0]?.notes, 'editado a mao');
  assert.equal(pres[0]?.description, null, 'nao completou depois da edicao');
});

test('spec 027: reentrega depois de aprovado ou descartado nao recria (FR-004)', async () => {
  const { db, useCase } = await setup();
  await db.users.save(User.create({ id: 'u1', cpf: Cpf.create('52998224725'), email: Email.create('m@exemplo.com'), phone: Phone.create('11987654321'), name: 'Marco', createdAt: NOW }).verifyEmail(NOW).verifyPhone(NOW));
  const approve = new ApprovePreRegistrationUseCase(db, new Sha1DeterministicIdGenerator(), new FixedClock(NOW));
  await capture(useCase, updated);
  const [first] = await db.preRegistrations.listByUser('u1');
  await db.preRegistrations.save(first!.update({ accountId: 'iti', paymentMethod: 'credit-card', date: NOW }));
  await approve.execute({ userId: 'u1', id: first!.id, confirmDuplicate: true });
  await capture(useCase, updated);
  assert.equal((await db.preRegistrations.listByUser('u1')).length, 0, 'aprovada nao volta');

  const other = { ...updated, notificationKey: '0|wallet|8|null|10123', when: (posted.when ?? 0) + 60_000 } as WalletNotification;
  await capture(useCase, other);
  const [second] = await db.preRegistrations.listByUser('u1');
  await new DiscardPreRegistrationUseCase(db, new FixedClock(NOW)).execute({ userId: 'u1', id: second!.id });
  await capture(useCase, other);
  assert.equal((await db.preRegistrations.listByUser('u1')).length, 0, 'descartada nao volta');
});
