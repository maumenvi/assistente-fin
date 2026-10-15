import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ExportBackupUseCase } from '../../../src/app/backup/export.backup.use.case.ts';
import { ImportBackupUseCase } from '../../../src/app/backup/import.backup.use.case.ts';
import { BACKUP_SCHEMA_VERSION, type BackupRecord } from '../../../src/app/shared/backup.record.schema.ts';
import { FakeDatabase } from '../../../src/database/fake/fake.database.ts';
import { User } from '../../../src/domain/user/user.entity.ts';
import { PreRegistration } from '../../../src/domain/pre-registration/pre.registration.entity.ts';
import { CaptureAttachment } from '../../../src/domain/pre-registration/capture.attachment.entity.ts';
import { Cpf } from '../../../src/domain/shared/cpf.value.object.ts';
import { Email } from '../../../src/domain/shared/email.value.object.ts';
import { Phone } from '../../../src/domain/shared/phone.value.object.ts';
import { Money } from '../../../src/domain/shared/money.value.object.ts';
import { FixedClock } from '../../support/fixed.clock.ts';

const NOW = new Date('2026-09-24T12:00:00.000Z');
const user = () =>
  User.create({ id: 'u1', cpf: Cpf.create('52998224725'), email: Email.create('m@e.com'), phone: Phone.create('11987654321'), name: 'M', createdAt: NOW })
    .verifyEmail(NOW)
    .verifyPhone(NOW);

async function* stream(records: readonly unknown[]) {
  for (const record of records) yield record;
}

test('backup v3 leva pre-registros e anexos de texto e volta igual (spec 022, T049)', async () => {
  const source = new FakeDatabase();
  await source.users.save(user());
  await source.preRegistrations.save(
    PreRegistration.create({
      id: 'p1',
      userId: 'u1',
      origin: 'nfce',
      createdAt: NOW,
      amount: Money.fromCents(21248),
      notes: 'https://sefaz/qr?p=1',
      dedupKey: 'chave',
      needsReview: true,
    }),
  );
  await source.captureAttachments.save(
    CaptureAttachment.create({ id: 'a1', userId: 'u1', preRegistrationId: 'p1', kind: 'ocr-text', content: 'TOTAL 212,48', sha256: 'c'.repeat(64), createdAt: NOW }),
  );
  const records: BackupRecord[] = [];
  for await (const record of await new ExportBackupUseCase(source, new FixedClock(NOW)).execute({ userId: 'u1' })) records.push(record);
  assert.equal(BACKUP_SCHEMA_VERSION, 3);
  assert.ok(records.some((r) => r.kind === 'preRegistration'));
  assert.ok(records.some((r) => r.kind === 'captureAttachment'));

  const target = new FakeDatabase();
  await target.users.save(user());
  const report = await new ImportBackupUseCase(target).execute({ userId: 'u1', records: stream(records) });
  assert.equal(report.preRegistrations, 1);
  const back = await target.preRegistrations.findById('u1', 'p1');
  assert.equal(back?.amount?.cents, 21248);
  assert.equal(back?.needsReview, true);
  assert.equal((await target.captureAttachments.listByPreRegistration('u1', 'p1'))[0]?.content, 'TOTAL 212,48');
});

test('importador aceita backup v2 (sem pre-registros)', async () => {
  const target = new FakeDatabase();
  await target.users.save(user());
  const report = await new ImportBackupUseCase(target).execute({
    userId: 'u1',
    records: stream([{ kind: 'header', schemaVersion: 2, userId: 'u1', exportedAt: NOW.toISOString() }]),
  });
  assert.equal(report.preRegistrations, 0);
});
