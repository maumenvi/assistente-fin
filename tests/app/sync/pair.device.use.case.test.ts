import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PairDeviceUseCase } from '../../../src/app/sync/pair.device.use.case.ts';
import { PairingRegistry } from '../../../src/app/sync/pairing.registry.ts';
import { decodePairingQr } from '../../../src/app/sync/pairing.qr.payload.ts';
import { FakePairedDeviceRepository } from '../../../src/database/fake/paired.device.repository.fake.ts';
import { NodeSecretGenerator } from '../../../src/libs/crypto/node.secret.generator.ts';
import { FakeCipher } from '../../support/fake.cipher.ts';
import { SequentialIdGenerator } from '../../support/sequential.id.generator.ts';
import { type Clock } from '../../../src/app/shared/clock.port.ts';

class MovableClock implements Clock {
  public current = new Date('2026-09-24T12:00:00.000Z');
  public now(): Date {
    return this.current;
  }
}

function setup() {
  const clock = new MovableClock();
  const devices = new FakePairedDeviceRepository();
  const useCase = new PairDeviceUseCase(devices, new PairingRegistry(), new NodeSecretGenerator(), new SequentialIdGenerator(), clock, new FakeCipher());
  return { clock, devices, useCase };
}

test('QR v2: enderecos, porta e segredo de uso unico; o celular le de volta', () => {
  const { useCase } = setup();
  const { text, payload } = useCase.openQr('u1', { hubId: 'hub', hosts: ['192.168.0.12'], port: 7333 });
  assert.match(text, /^financecontroller:\/\/pair\?d=/);
  assert.deepEqual(decodePairingQr(text), payload);
  assert.equal(decodePairingQr('https://outro.site'), null);
});

test('pareia uma vez; o mesmo QR de novo -> PAIRING_USED; expirado -> PAIRING_EXPIRED', async () => {
  const { useCase, clock } = setup();
  const { payload } = useCase.openQr('u1', { hubId: 'hub', hosts: ['h'], port: 7333 });
  const { userId } = useCase.takePairing(payload.pairingId);
  const credentials = await useCase.register(userId, 'Pixel 8');
  assert.equal(credentials.userId, 'u1');
  assert.throws(() => useCase.takePairing(payload.pairingId), { code: 'PAIRING_USED' });
  const second = useCase.openQr('u1', { hubId: 'hub', hosts: ['h'], port: 7333 });
  clock.current = new Date(clock.current.getTime() + 6 * 60_000);
  assert.throws(() => useCase.takePairing(second.payload.pairingId), { code: 'PAIRING_EXPIRED' });
});

test('autentica com o token; revogado -> DEVICE_REVOKED (FR-014)', async () => {
  const { useCase } = setup();
  const { payload } = useCase.openQr('u1', { hubId: 'hub', hosts: ['h'], port: 7333 });
  const credentials = await useCase.register(useCase.takePairing(payload.pairingId).userId, 'Pixel');
  const auth = await useCase.authenticate(credentials.deviceId, credentials.token);
  assert.equal(auth.deviceKey, credentials.deviceKey);
  await assert.rejects(useCase.authenticate(credentials.deviceId, 'errado'), { code: 'DEVICE_UNKNOWN' });
  await useCase.revoke('u1', credentials.deviceId);
  await assert.rejects(useCase.authenticate(credentials.deviceId, credentials.token), { code: 'DEVICE_REVOKED' });
});

test('deviceKeyFor: chave sem token, sem marcar uso; desconhecido e revogado recusados (024 T005)', async () => {
  const { useCase, devices } = setup();
  const { payload } = useCase.openQr('u1', { hubId: 'hub', hosts: ['h'], port: 7333 });
  const credentials = await useCase.register(useCase.takePairing(payload.pairingId).userId, 'Pixel');
  const found = await useCase.deviceKeyFor(credentials.deviceId);
  assert.equal(found.deviceKey, credentials.deviceKey);
  assert.equal(found.device.id, credentials.deviceId);
  assert.equal((await devices.findById(credentials.deviceId))?.lastSeenAt, null);
  await assert.rejects(useCase.deviceKeyFor('nao-existe'), { code: 'DEVICE_UNKNOWN' });
  await useCase.revoke('u1', credentials.deviceId);
  await assert.rejects(useCase.deviceKeyFor(credentials.deviceId), { code: 'DEVICE_REVOKED' });
});

test('chave do aparelho de outra instalacao (nao abre com a chave local) -> DEVICE_UNKNOWN, nao erro interno (024 T058)', async () => {
  const { useCase, devices } = setup();
  const { payload } = useCase.openQr('u1', { hubId: 'hub', hosts: ['h'], port: 7333 });
  const credentials = await useCase.register(useCase.takePairing(payload.pairingId).userId, 'Pixel');
  const saved = await devices.findById(credentials.deviceId);
  await devices.save({ ...saved!, keyCiphertext: 'cifrado-por-outra-instalacao' });
  await assert.rejects(useCase.authenticate(credentials.deviceId, credentials.token), { code: 'DEVICE_UNKNOWN' });
  await assert.rejects(useCase.deviceKeyFor(credentials.deviceId), { code: 'DEVICE_UNKNOWN' });
});
