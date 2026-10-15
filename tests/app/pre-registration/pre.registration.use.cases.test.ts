import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CreatePreRegistrationUseCase } from '../../../src/app/pre-registration/create.pre.registration.use.case.ts';
import { UpdatePreRegistrationUseCase } from '../../../src/app/pre-registration/update.pre.registration.use.case.ts';
import { DiscardPreRegistrationUseCase } from '../../../src/app/pre-registration/discard.pre.registration.use.case.ts';
import { ListPreRegistrationsUseCase } from '../../../src/app/pre-registration/list.pre.registrations.use.case.ts';
import { FakeDatabase } from '../../../src/database/fake/fake.database.ts';
import { Transaction } from '../../../src/domain/transaction/transaction.entity.ts';
import { Money } from '../../../src/domain/shared/money.value.object.ts';
import { CaptureAttachment } from '../../../src/domain/pre-registration/capture.attachment.entity.ts';
import { PreRegistrationNotFoundError } from '../../../src/domain/pre-registration/pre.registration.not.found.error.ts';
import { InvalidInputError } from '../../../src/app/shared/invalid.input.error.ts';
import { InvalidPreRegistrationError } from '../../../src/domain/pre-registration/invalid.pre.registration.error.ts';
import { FixedClock } from '../../support/fixed.clock.ts';
import { SequentialIdGenerator } from '../../support/sequential.id.generator.ts';

const NOW = new Date('2026-09-24T12:00:00.000Z');

function setup() {
  const db = new FakeDatabase();
  return {
    db,
    create: new CreatePreRegistrationUseCase(db, new SequentialIdGenerator(), new FixedClock(NOW)),
    update: new UpdatePreRegistrationUseCase(db),
    discard: new DiscardPreRegistrationUseCase(db, { now: () => new Date('2026-09-24T12:00:00Z') }),
    list: new ListPreRegistrationsUseCase(db.preRegistrations),
  };
}

test('cria incompleto e nao mexe em lancamentos (FR-021, FR-022)', async () => {
  const { db, create, list } = setup();
  const pre = await create.execute({ userId: 'u1', amountCents: 6500, description: 'Queijo' });
  assert.equal(pre.origin, 'manual');
  assert.equal((await list.execute({ userId: 'u1' })).length, 1);
  assert.equal((await db.transactions.listByUser('u1')).length, 0);
});

test('marca possivel duplicata de lancamento existente, sem bloquear (FR-027)', async () => {
  const { db, create } = setup();
  await db.transactions.save(
    Transaction.create({
      id: 't1',
      userId: 'u1',
      date: new Date('2026-09-24T18:00:00.000Z'),
      amount: Money.fromCents(6500),
      type: 'expense',
      categoryId: 'c',
      accountId: 'a',
      notes: 'queijo',
    }),
  );
  const pre = await create.execute({ userId: 'u1', amountCents: 6500, description: 'Queijo', date: '2026-09-24' });
  assert.equal(pre.possibleDuplicateOf, 't1');
  const again = await create.execute({ userId: 'u1', dedupKey: 'nota-9' });
  const twin = await create.execute({ userId: 'u1', dedupKey: 'nota-9' });
  assert.equal(again.possibleDuplicateOf, null);
  assert.equal(twin.possibleDuplicateOf, again.id);
});

test('edita qualquer campo; null limpa; regras da entidade valem (FR-023)', async () => {
  const { create, update } = setup();
  const pre = await create.execute({ userId: 'u1', amountCents: 100, accountId: 'a' });
  const edited = await update.execute({ userId: 'u1', id: pre.id, accountId: null, paymentMethod: 'credit-card', installments: 3 });
  assert.equal(edited.accountId, null);
  assert.equal(edited.installments, 3);
  await assert.rejects(update.execute({ userId: 'u1', id: pre.id, paymentMethod: 'pix' }), InvalidPreRegistrationError);
  await assert.rejects(update.execute({ userId: 'u1', id: pre.id, amountCents: -1 }), InvalidInputError);
});

test('descartar remove pre-registro e anexos (FR-026)', async () => {
  const { db, create, discard } = setup();
  const pre = await create.execute({ userId: 'u1' });
  await db.captureAttachments.save(
    CaptureAttachment.create({ id: 'x', userId: 'u1', preRegistrationId: pre.id, kind: 'ocr-text', content: 'x', sha256: 'b'.repeat(64), createdAt: NOW }),
  );
  await discard.execute({ userId: 'u1', id: pre.id });
  assert.equal(await db.preRegistrations.findById('u1', pre.id), null);
  assert.equal((await db.captureAttachments.listByPreRegistration('u1', pre.id)).length, 0);
  await assert.rejects(discard.execute({ userId: 'u1', id: pre.id }), PreRegistrationNotFoundError);
});

test('spec 027: descartar grava o destino "discarded"', async () => {
  const { db, create, discard } = setup();
  const pre = await create.execute({ userId: 'u1', amountCents: 6500, description: 'Queijo' });
  await discard.execute({ userId: 'u1', id: pre.id });
  assert.equal((await db.preRegistrationOutcomes.find('u1', pre.id))?.outcome, 'discarded');
});

test('spec 028: um pre-registro ja revisado ("sao diferentes") continua candidato para um pre-registro NOVO', async () => {
  const { db, create } = setup();
  const first = await create.execute({ userId: 'u1', amountCents: 1850, description: 'Café do Zé', date: NOW.toISOString() });
  await db.preRegistrations.save(first.update({ duplicateReviewed: true }));
  const third = await create.execute({ userId: 'u1', amountCents: 1850, description: 'Café do Zé', date: NOW.toISOString() });
  assert.equal(third.possibleDuplicateOf, first.id, 'a compra nova ainda e sinalizada contra a revisada');
});
