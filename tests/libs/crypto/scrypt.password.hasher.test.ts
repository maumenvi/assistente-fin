import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ScryptPasswordHasher } from '../../../src/libs/crypto/scrypt.password.hasher.ts';

const hasher = new ScryptPasswordHasher();

test('hash nao devolve o texto claro e tem o formato scrypt$N$r$p$salt$dk', async () => {
  const hash = await hasher.hash('senha1234');

  assert.notEqual(hash, 'senha1234');
  const parts = hash.split('$');
  assert.equal(parts.length, 6);
  assert.equal(parts[0], 'scrypt');
});

test('verify aceita a senha certa e recusa a errada', async () => {
  const hash = await hasher.hash('correta');

  assert.equal(await hasher.verify('correta', hash), true);
  assert.equal(await hasher.verify('errada', hash), false);
});

test('dois hashes da mesma senha diferem (sal aleatorio)', async () => {
  const a = await hasher.hash('mesma');
  const b = await hasher.hash('mesma');

  assert.notEqual(a, b);
  assert.equal(await hasher.verify('mesma', a), true);
  assert.equal(await hasher.verify('mesma', b), true);
});

test('verify devolve false pra hash malformado, sem lancar', async () => {
  assert.equal(await hasher.verify('x', 'nao-e-um-hash'), false);
  assert.equal(await hasher.verify('x', 'scrypt$32768$8$1$soh-quatro-partes'), false);
  assert.equal(await hasher.verify('x', 'scrypt$abc$8$1$c2FsdA==$ZGs='), false);
  assert.equal(await hasher.verify('x', ''), false);
});
