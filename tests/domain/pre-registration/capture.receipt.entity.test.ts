import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CaptureReceipt } from '../../../src/domain/pre-registration/capture.receipt.entity.ts';
import { InvalidPreRegistrationError } from '../../../src/domain/pre-registration/invalid.pre.registration.error.ts';

const at = new Date('2026-10-01T12:00:00Z');
const receipt = () => CaptureReceipt.create({ userId: 'u1', captureKey: 'wallet:k', preRegistrationId: 'p1', createdAt: at });

test('CaptureReceipt.create: nasce pendente, sem versao nem resolucao', () => {
  const r = receipt();
  assert.equal(r.resolution, 'pending');
  assert.equal(r.isPending, true);
  assert.equal(r.captureVersion, null);
  assert.equal(r.resolvedAt, null);
});

test('CaptureReceipt.resolve: pendente -> aprovado; idempotente; nao troca resolucao', () => {
  const later = new Date('2026-10-01T13:00:00Z');
  const approved = receipt().resolve('approved', later);
  assert.equal(approved.resolution, 'approved');
  assert.equal(approved.resolvedAt?.getTime(), later.getTime());
  assert.equal(approved.resolve('approved', new Date()), approved);
  assert.throws(() => approved.resolve('discarded', new Date()), InvalidPreRegistrationError);
});

test('CaptureReceipt.withCaptureVersion e fromPersistence', () => {
  assert.equal(receipt().withCaptureVersion('2026-10-01T12:00:01.000Z').captureVersion, '2026-10-01T12:00:01.000Z');
  assert.throws(
    () => CaptureReceipt.fromPersistence({ userId: 'u1', captureKey: 'k', preRegistrationId: 'p', resolution: 'x' as never, captureVersion: null, createdAt: at, resolvedAt: null }),
    InvalidPreRegistrationError,
  );
});

test('CaptureReceipt.withPreRegistrationId: aponta para outro pre sem mexer no resto (spec 028)', () => {
  const resolved = receipt().withCaptureVersion('v1');
  const moved = resolved.withPreRegistrationId('p2');
  assert.equal(moved.preRegistrationId, 'p2');
  assert.equal(moved.captureVersion, 'v1');
  assert.equal(moved.captureKey, 'wallet:k');
  assert.equal(resolved.preRegistrationId, 'p1');
  assert.throws(() => resolved.withPreRegistrationId('  '), InvalidPreRegistrationError);
});
