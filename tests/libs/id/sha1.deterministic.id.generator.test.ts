import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Sha1DeterministicIdGenerator } from '../../../src/libs/id/sha1.deterministic.id.generator.ts';

test('mesmo nome, mesmo id; nomes diferentes, ids diferentes; formato UUID v5', () => {
  const ids = new Sha1DeterministicIdGenerator();
  const a = ids.derive('pre-1:0');
  assert.equal(a, new Sha1DeterministicIdGenerator().derive('pre-1:0'));
  assert.notEqual(a, ids.derive('pre-1:1'));
  assert.match(a, /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
});

test('bate com um UUID v5 de referencia (namespace DNS da RFC 4122)', async () => {
  const { formatUuidV5, uuidToBytes } = await import('../../../src/app/shared/format.uuid.v5.ts');
  const { createHash } = await import('node:crypto');
  const hash = createHash('sha1').update(uuidToBytes('6ba7b810-9dad-11d1-80b4-00c04fd430c8')).update('www.example.com').digest();
  assert.equal(formatUuidV5(new Uint8Array(hash)), '2ed6657d-e927-568b-95e1-2665a8aea6a2');
});
