import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FakeDatabase } from '../../../src/database/fake/fake.database.ts';
import { CaptureReceipt } from '../../../src/domain/pre-registration/capture.receipt.entity.ts';
import { PurgeCaptureMemoryUseCase } from '../../../src/app/pre-registration/purge.capture.memory.use.case.ts';

test('purgeCaptureMemory: apaga resolvidos e destinos com mais de 30 dias; pendentes ficam', async () => {
  const database = new FakeDatabase();
  const now = new Date('2026-10-01T12:00:00Z');
  const old = new Date('2026-08-20T12:00:00Z');
  const recent = new Date('2026-09-20T12:00:00Z');
  const receipt = (key: string) => CaptureReceipt.create({ userId: 'u1', captureKey: key, preRegistrationId: key, createdAt: old });
  await database.captureReceipts.insertIfAbsent(receipt('old'));
  await database.captureReceipts.insertIfAbsent(receipt('recent'));
  await database.captureReceipts.insertIfAbsent(receipt('pending'));
  await database.captureReceipts.save(receipt('old').resolve('approved', old));
  await database.captureReceipts.save(receipt('recent').resolve('discarded', recent));
  await database.preRegistrationOutcomes.record({ userId: 'u1', preRegistrationId: 'old', outcome: 'approved', transactionId: null, at: old });

  const purged = await new PurgeCaptureMemoryUseCase(database, { now: () => now }).execute({ userId: 'u1' });
  assert.deepEqual(purged, { receipts: 1, outcomes: 1 });
  assert.equal(await database.captureReceipts.findByKey('u1', 'old'), null);
  assert.ok(await database.captureReceipts.findByKey('u1', 'recent'));
  assert.ok(await database.captureReceipts.findByKey('u1', 'pending'));
});
