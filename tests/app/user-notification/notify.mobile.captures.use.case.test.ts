import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FakeDatabase } from '../../../src/database/fake/fake.database.ts';
import { type SyncOp } from '../../../src/app/sync/sync.op.ts';
import { type SyncOpResult } from '../../../src/app/sync/sync.op.result.ts';
import { type BackupRecord } from '../../../src/app/shared/backup.record.schema.ts';
import { EmitUserNotificationUseCase } from '../../../src/app/user-notification/emit.user.notification.use.case.ts';
import { NotifyMobileCapturesUseCase } from '../../../src/app/user-notification/notify.mobile.captures.use.case.ts';
import { upsertAccount } from '../sync/sync.fixtures.ts';

function capture(opId: string, origin: string, extra: Record<string, unknown> = {}): SyncOp {
  const record = { kind: 'preRegistration', id: `p-${opId}`, userId: 'u1', origin, needsReview: true, manualOnly: false, createdAt: '2026-10-01', ...extra } as BackupRecord;
  return { opId, entity: 'preRegistration', entityId: `p-${opId}`, kind: 'upsert', baseVersion: null, record };
}
const applied = (opId: string): SyncOpResult => ({ opId, status: 'applied', version: 'v1' });

function setup() {
  const database = new FakeDatabase();
  let seq = 0;
  const emit = new EmitUserNotificationUseCase(database, { next: () => `n${++seq}` }, { now: () => new Date('2026-10-01T12:00:00Z') }, { deliver: () => {} });
  return { database, notify: new NotifyMobileCapturesUseCase(emit) };
}

test('uma captura nova -> uma notificacao mobile-capture com titulo e mensagem', async () => {
  const { database, notify } = setup();
  await notify.execute({ userId: 'u1', ops: [capture('o1', 'wallet', { amountCents: 4290, description: 'Mercado' })], results: [applied('o1')] });
  const page = await database.userNotifications.listByUser('u1', { page: 1, pageSize: 10, unreadOnly: false });
  assert.equal(page.total, 1);
  assert.equal(page.items[0]?.source, 'mobile-capture');
  assert.equal(page.items[0]?.title, 'Captura do celular');
  assert.match(page.items[0]?.message ?? '', /Mercado$/);
});

test('varias capturas no lote -> um unico resumo', async () => {
  const { database, notify } = setup();
  await notify.execute({ userId: 'u1', ops: [capture('o1', 'nfce'), capture('o2', 'voice')], results: [applied('o1'), applied('o2')] });
  const page = await database.userNotifications.listByUser('u1', { page: 1, pageSize: 10, unreadOnly: false });
  assert.equal(page.total, 1);
  assert.equal(page.items[0]?.message, '2 novas capturas do celular para revisar');
});

test('lote sem captura nova (conta, manual, duplicado) -> nada', async () => {
  const { database, notify } = setup();
  await notify.execute({
    userId: 'u1',
    ops: [upsertAccount('a1', 'acc', 'Itau', null), capture('o1', 'manual'), capture('o2', 'wallet')],
    results: [applied('a1'), applied('o1'), { opId: 'o2', status: 'duplicate', version: 'v1' }],
  });
  assert.equal(await database.userNotifications.countUnread('u1'), 0);
});
