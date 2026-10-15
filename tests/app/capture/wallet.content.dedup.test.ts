import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CreatePreRegistrationFromCaptureUseCase } from '../../../src/app/capture/create.pre.registration.from.capture.use.case.ts';
import { DiscardPreRegistrationUseCase } from '../../../src/app/pre-registration/discard.pre.registration.use.case.ts';
import { FakeDatabase } from '../../../src/database/fake/fake.database.ts';
import { Account } from '../../../src/domain/account/account.entity.ts';
import { Money } from '../../../src/domain/shared/money.value.object.ts';
import { parseWalletNotification } from '../../../src/domain/capture/parse.wallet.notification.ts';
import { type WalletNotification } from '../../../src/domain/capture/wallet.notification.ts';
import { ApprovePreRegistrationUseCase } from '../../../src/app/pre-registration/approve.pre.registration.use.case.ts';
import { Sha1DeterministicIdGenerator } from '../../../src/libs/id/sha1.deterministic.id.generator.ts';
import { User } from '../../../src/domain/user/user.entity.ts';
import { Cpf } from '../../../src/domain/shared/cpf.value.object.ts';
import { Email } from '../../../src/domain/shared/email.value.object.ts';
import { Phone } from '../../../src/domain/shared/phone.value.object.ts';
import { MutableClock } from '../../support/mutable.clock.ts';
import { SequentialIdGenerator } from '../../support/sequential.id.generator.ts';

/**
 * Spec 028 (T013, research R10): reproducao do log real de 2026-10-13 - a mesma compra chega como
 * VARIAS notificacoes com `notificationKey` e `when` diferentes (5 a ~90 s), e cada uma virava um
 * pre-registro. A deduplicacao por conteudo precisa juntar as da mesma compra, sem fundir compras
 * reais diferentes.
 */
const WALLET = 'com.google.android.apps.walletnfcrel';
const T0 = Date.parse('2026-10-11T16:00:00Z');
const T0_DATE = new Date(T0);
let sequence = 0;

function notification(offsetSeconds: number, title: string, text: string): WalletNotification {
  sequence += 1;
  const when = T0 + offsetSeconds * 1000;
  return { packageName: WALLET, notificationKey: `0|${WALLET}|1001|${String(-sequence * 7919)}|10357`, when, postTime: when + 700, title, text };
}

async function setup() {
  const db = new FakeDatabase();
  await db.accounts.save(Account.create({ id: 'nubank', userId: 'u1', name: 'Nubank final 4321', kind: 'credit-card', openingBalance: Money.zero() }));
  const clock = new MutableClock(new Date(T0));
  const useCase = new CreatePreRegistrationFromCaptureUseCase(db, new SequentialIdGenerator(), clock);
  const capture = (n: WalletNotification) => {
    clock.set(new Date((n.when ?? T0) + 1000));
    return useCase.execute({ userId: 'u1', draft: parseWalletNotification(n) });
  };
  return { db, clock, capture };
}

const cafe = (offset: number) => notification(offset, 'Google Wallet', 'R$ 18,50 em Café do Zé com Nubank •••• 4321');

test('3 compras, cada uma com 2 notificacoes de identidades diferentes (5 a 89 s) = 3 pre-registros', async () => {
  const { db, capture } = await setup();
  const results = [
    await capture(cafe(0)),
    await capture(cafe(74)),
    await capture(notification(1200, 'Google Wallet', 'R$ 42,90 em Padaria Pão Quente com Nubank •••• 4321')),
    await capture(notification(1205, 'Google Wallet', 'R$ 42,90 em Padaria Pão Quente com Nubank •••• 4321')),
    await capture(notification(2400, 'Google Wallet', 'R$ 9,00 em Banca com Nubank •••• 4321')),
    await capture(notification(2489, 'Google Wallet', 'R$ 9,00 em Banca com Nubank •••• 4321')),
  ];
  assert.equal((await db.preRegistrations.listByUser('u1')).length, 3);
  assert.deepEqual(results.map((r) => r.decision), ['created', 'merged', 'created', 'merged', 'created', 'merged']);
  assert.equal(results[1]?.preRegistration?.id, results[0]?.preRegistration?.id);
});

test('tres notificacoes da mesma compra = um pre-registro', async () => {
  const { db, capture } = await setup();
  await capture(cafe(0));
  await capture(cafe(5));
  await capture(cafe(89));
  assert.equal((await db.preRegistrations.listByUser('u1')).length, 1);
});

test('mesma compra repetida depois de mais de 3 minutos = 2 pre-registros, o segundo sinalizado (spec 027)', async () => {
  const { db, capture } = await setup();
  const first = await capture(cafe(0));
  const second = await capture(cafe(240));
  assert.equal(second.decision, 'created');
  const pres = await db.preRegistrations.listByUser('u1');
  assert.equal(pres.length, 2);
  assert.equal(second.preRegistration?.possibleDuplicateOf, first.preRegistration?.id);
});

test('valor, estabelecimento ou cartao diferentes dentro da janela = pre-registros separados', async () => {
  const { db, capture } = await setup();
  await capture(cafe(0));
  await capture(notification(10, 'Google Wallet', 'R$ 19,50 em Café do Zé com Nubank •••• 4321'));
  await capture(notification(20, 'Google Wallet', 'R$ 18,50 em Padaria com Nubank •••• 4321'));
  await capture(notification(30, 'Google Wallet', 'R$ 18,50 em Café do Zé com Itaú •••• 9999'));
  assert.equal((await db.preRegistrations.listByUser('u1')).length, 4);
});

test('pre-registro ja editado pelo usuario nao e alterado e nada novo e criado', async () => {
  const { db, capture } = await setup();
  await capture(notification(0, 'Google Wallet', 'R$ 18,50 com Nubank •••• 4321'));
  const [pre] = await db.preRegistrations.listByUser('u1');
  await db.preRegistrations.save(pre!.update({ notes: 'editado a mao' }));
  const result = await capture(cafe(30));
  assert.equal(result.decision, 'ignored-edited');
  const pres = await db.preRegistrations.listByUser('u1');
  assert.equal(pres.length, 1);
  assert.equal(pres[0]?.notes, 'editado a mao');
  assert.equal(pres[0]?.description, null, 'nao completou depois da edicao');
});

test('compra descartada nao atrai notificacao equivalente: vira pre-registro novo', async () => {
  const { db, clock, capture } = await setup();
  const first = await capture(cafe(0));
  await new DiscardPreRegistrationUseCase(db, clock).execute({ userId: 'u1', id: first.preRegistration!.id });
  const again = await capture(cafe(30));
  assert.equal(again.decision, 'created');
  assert.equal((await db.preRegistrations.listByUser('u1')).length, 1);
});

test('primeira notificacao sem estabelecimento, segunda com: um pre-registro com o estabelecimento', async () => {
  const { db, capture } = await setup();
  await capture(notification(0, 'Google Wallet', 'R$ 18,50 com Nubank •••• 4321'));
  const second = await capture(cafe(30));
  assert.equal(second.decision, 'merged');
  const pres = await db.preRegistrations.listByUser('u1');
  assert.equal(pres.length, 1);
  assert.equal(pres[0]?.description, 'Café do Zé');
});

test('reentrega da chave juntada depois de a compra ser resolvida nao recria nada', async () => {
  const { db, clock, capture } = await setup();
  const first = await capture(cafe(0));
  const secondNotification = cafe(74);
  await capture(secondNotification);
  await new DiscardPreRegistrationUseCase(db, clock).execute({ userId: 'u1', id: first.preRegistration!.id });
  const redelivery = await capture(secondNotification);
  assert.equal(redelivery.decision, 'ignored-resolved');
  assert.equal((await db.preRegistrations.listByUser('u1')).length, 0);
});

test('Pix sem cartao: sem estabelecimento seguido de com estabelecimento junta a 40 s e nao a 90 s', async () => {
  const near = await setup();
  await near.capture(notification(0, 'Google Wallet', 'Pix enviado R$ 9,00'));
  const merged = await near.capture(notification(40, 'Google Wallet', 'Pix enviado R$ 9,00 para Banca'));
  assert.equal(merged.decision, 'merged');
  assert.equal((await near.db.preRegistrations.listByUser('u1')).length, 1);

  const far = await setup();
  await far.capture(notification(0, 'Google Wallet', 'Pix enviado R$ 9,00'));
  await far.capture(notification(90, 'Google Wallet', 'Pix enviado R$ 9,00 para Banca'));
  assert.equal((await far.db.preRegistrations.listByUser('u1')).length, 2);
});

test('aprovar resolve TODOS os recibos do pre-registro; reentrega de qualquer chave nao recria', async () => {
  const { db, clock, capture } = await setup();
  await db.users.save(User.create({ id: 'u1', cpf: Cpf.create('52998224725'), email: Email.create('m@exemplo.com'), phone: Phone.create('11987654321'), name: 'Marco', createdAt: T0_DATE }).verifyEmail(T0_DATE).verifyPhone(T0_DATE));
  const firstNotification = cafe(0);
  const secondNotification = cafe(74);
  const first = await capture(firstNotification);
  await capture(secondNotification);
  const id = first.preRegistration!.id;
  await db.preRegistrations.save((await db.preRegistrations.findById('u1', id))!.update({ date: T0_DATE, paymentMethod: 'credit-card' }));
  await new ApprovePreRegistrationUseCase(db, new Sha1DeterministicIdGenerator(), clock).execute({ userId: 'u1', id, confirmDuplicate: true });

  for (const receipt of await db.captureReceipts.listByPreRegistration('u1', id)) assert.equal(receipt.resolution, 'approved');
  assert.equal((await db.captureReceipts.listByPreRegistration('u1', id)).length, 2);
  assert.equal((await capture(firstNotification)).decision, 'ignored-resolved');
  assert.equal((await capture(secondNotification)).decision, 'ignored-resolved');
  assert.equal((await db.preRegistrations.listByUser('u1')).length, 0);
});
