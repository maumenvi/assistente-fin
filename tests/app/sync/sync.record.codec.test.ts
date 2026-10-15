import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SYNC_CODECS } from '../../../src/app/sync/sync.record.codec.ts';
import { SYNC_ENTITIES } from '../../../src/app/sync/sync.entity.ts';
import { canonicalRecord } from '../../../src/app/sync/canonical.record.ts';
import { FakeDatabase } from '../../../src/database/fake/fake.database.ts';
import { PreRegistration } from '../../../src/domain/pre-registration/pre.registration.entity.ts';
import { CaptureAttachment } from '../../../src/domain/pre-registration/capture.attachment.entity.ts';
import { Money } from '../../../src/domain/shared/money.value.object.ts';
import { account } from './sync.fixtures.ts';

const NOW = new Date('2026-09-24T12:00:00Z');

test('ha um codec para cada entidade sincronizada, na ordem pais -> filhos', () => {
  assert.deepEqual(Object.keys(SYNC_CODECS).sort(), [...SYNC_ENTITIES].sort());
  assert.ok(SYNC_ENTITIES.indexOf('account') < SYNC_ENTITIES.indexOf('transaction'));
  assert.ok(SYNC_ENTITIES.indexOf('preRegistration') < SYNC_ENTITIES.indexOf('captureAttachment'));
});

test('record -> entidade -> record preserva o conteudo; versao = updatedAt ou sha256', async () => {
  const db = new FakeDatabase();
  await db.accounts.save(account('a1'));
  await db.preRegistrations.save(PreRegistration.create({ id: 'p1', userId: 'u1', origin: 'voice', createdAt: NOW, amount: Money.fromCents(100) }));
  await db.captureAttachments.save(
    CaptureAttachment.create({ id: 'x1', userId: 'u1', preRegistrationId: 'p1', kind: 'speech-text', content: 'oi', sha256: 'f'.repeat(64), createdAt: NOW }),
  );
  for (const [entity, id] of [['account', 'a1'], ['preRegistration', 'p1'], ['captureAttachment', 'x1']] as const) {
    const codec = SYNC_CODECS[entity];
    const found = await codec.find(db, 'u1', id);
    assert.ok(found, entity);
    const record = codec.toRecord(found);
    assert.equal(canonicalRecord(codec.toRecord(codec.fromRecord(record))), canonicalRecord(record), entity);
    assert.equal((await codec.list(db, 'u1')).length, 1, entity);
  }
  const attachment = await SYNC_CODECS.captureAttachment.find(db, 'u1', 'x1');
  assert.equal(attachment && SYNC_CODECS.captureAttachment.version(attachment), 'f'.repeat(64));
  const acc = await SYNC_CODECS.account.find(db, 'u1', 'a1');
  assert.match((acc && SYNC_CODECS.account.version(acc)) ?? '', /^\d{4}-\d{2}-\d{2}T/);
});

test('canonicalRecord ignora ordem das chaves e o dono', () => {
  assert.equal(canonicalRecord({ b: 1, a: { d: 1, c: 2 }, userId: 'x' }), canonicalRecord({ userId: 'y', a: { c: 2, d: 1 }, b: 1 }));
});
