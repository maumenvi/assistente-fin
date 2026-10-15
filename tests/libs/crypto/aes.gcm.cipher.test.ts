import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { AesGcmCipher } from '../../../src/libs/crypto/aes.gcm.cipher.ts';

const KEY_HEX = randomBytes(32).toString('hex');

test('roundtrip: decrypt(encrypt(x)) === x', () => {
  const cipher = new AesGcmCipher(KEY_HEX);
  for (const plain of ['123456', '000000', 'texto qualquer com acento: joão']) {
    assert.equal(cipher.decrypt(cipher.encrypt(plain)), plain);
  }
});

test('o envelope nao contem o texto claro e muda a cada chamada (IV aleatorio)', () => {
  const cipher = new AesGcmCipher(KEY_HEX);
  const a = cipher.encrypt('123456');
  const b = cipher.encrypt('123456');
  assert.notEqual(a, b);
  assert.doesNotMatch(a, /123456/);
});

test('aceita chave em hex ou base64; rejeita tamanho errado', () => {
  const raw = randomBytes(32);
  assert.doesNotThrow(() => new AesGcmCipher(raw.toString('hex')));
  assert.doesNotThrow(() => new AesGcmCipher(raw.toString('base64')));
  assert.throws(() => new AesGcmCipher('curtademais'), /32 bytes/);
  assert.throws(() => new AesGcmCipher(randomBytes(16).toString('hex')), /32 bytes/);
});

test('decrypt rejeita envelope adulterado ou de outra chave', () => {
  const envelope = new AesGcmCipher(KEY_HEX).encrypt('123456');

  assert.throws(() => new AesGcmCipher(randomBytes(32).toString('hex')).decrypt(envelope));

  const parts = envelope.split('.');
  const tampered = [parts[0], parts[1], parts[2], Buffer.from('outro').toString('base64')].join('.');
  assert.throws(() => new AesGcmCipher(KEY_HEX).decrypt(tampered));

  assert.throws(() => new AesGcmCipher(KEY_HEX).decrypt('naoehenvelope'), /invalido/);
});
