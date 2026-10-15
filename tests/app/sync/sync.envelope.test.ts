import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openEnvelope, sealEnvelope } from '../../../src/app/sync/sync.envelope.ts';
import { ReplayGuard } from '../../../src/app/sync/replay.guard.ts';
import { AesGcmAeadCipher } from '../../../src/libs/crypto/aes.gcm.aead.cipher.ts';

const KEY = 'a'.repeat(64);
const NOW = new Date('2026-09-24T12:00:00.000Z');

test('cifra e abre com o mesmo aparelho, horario e nonce', () => {
  const cipher = new AesGcmAeadCipher(KEY);
  const guard = new ReplayGuard();
  const envelope = sealEnvelope(cipher, 'cel-1', 'nonce-0001', NOW, { ops: [1, 2] });
  assert.ok(!envelope.ct.includes('ops'));
  const opened = openEnvelope(cipher, envelope, NOW, (n, t) => guard.check(n, t));
  assert.deepEqual(opened, { deviceId: 'cel-1', payload: { ops: [1, 2] } });
});

test('horario fora de +-5 min -> STALE_REQUEST; repetido -> REPLAY', () => {
  const cipher = new AesGcmAeadCipher(KEY);
  const guard = new ReplayGuard();
  const old = sealEnvelope(cipher, 'cel-1', 'nonce-0002', new Date(NOW.getTime() - 6 * 60_000), {});
  assert.throws(() => openEnvelope(cipher, old, NOW, () => false), { code: 'STALE_REQUEST' });
  const envelope = sealEnvelope(cipher, 'cel-1', 'nonce-0003', NOW, {});
  openEnvelope(cipher, envelope, NOW, (n, t) => guard.check(n, t));
  assert.throws(() => openEnvelope(cipher, envelope, NOW, (n, t) => guard.check(n, t)), { code: 'REPLAY' });
});

test('trocar aparelho, chave ou texto -> BAD_ENVELOPE', () => {
  const cipher = new AesGcmAeadCipher(KEY);
  const envelope = sealEnvelope(cipher, 'cel-1', 'nonce-0004', NOW, { a: 1 });
  assert.throws(() => openEnvelope(cipher, { ...envelope, deviceId: 'cel-2' }, NOW, () => false), { code: 'BAD_ENVELOPE' });
  assert.throws(() => openEnvelope(new AesGcmAeadCipher('b'.repeat(64)), envelope, NOW, () => false), { code: 'BAD_ENVELOPE' });
  assert.throws(() => openEnvelope(cipher, { ...envelope, ct: `${envelope.ct}x` }, NOW, () => false), { code: 'BAD_ENVELOPE' });
  assert.throws(() => openEnvelope(cipher, { lixo: true }, NOW, () => false), { code: 'BAD_ENVELOPE' });
});
