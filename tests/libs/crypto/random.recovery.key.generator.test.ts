import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RandomRecoveryKeyGenerator } from '../../../src/libs/crypto/random.recovery.key.generator.ts';

const KEY_PATTERN = /^[0-9A-HJKMNP-TV-Z]{5}(-[0-9A-HJKMNP-TV-Z]{5}){4}$/;

test('next gera 5 grupos de 5 caracteres base32 (Crockford) separados por hifen', () => {
  const generator = new RandomRecoveryKeyGenerator();

  for (let i = 0; i < 50; i += 1) {
    assert.match(generator.next(), KEY_PATTERN);
  }
});

test('next gera chaves distintas', () => {
  const generator = new RandomRecoveryKeyGenerator();
  const keys = new Set<string>();

  for (let i = 0; i < 500; i += 1) {
    keys.add(generator.next());
  }

  assert.equal(keys.size, 500);
});
