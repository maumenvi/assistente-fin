import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { describe, it } from 'node:test';
import { sha256Hex } from '../../../src/libs/crypto/sha256.ts';

describe('sha256Hex (JS puro)', () => {
  it('vetores NIST', () => {
    assert.equal(sha256Hex(''), 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    assert.equal(sha256Hex('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    assert.equal(sha256Hex('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq'), '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1');
    assert.equal(sha256Hex('a'.repeat(1_000_000)), 'cdc76e5c9914fb9281a1c7e284d73e67f1809a48a497200e046d39ccc7112cd0');
  });
  it('entrada em bytes e UTF-8 multibyte conferem com node:crypto', () => {
    for (const text of ['ação', 'R$ 1.284,60 — ok', '😀 emoji', 'x'.repeat(55), 'x'.repeat(56), 'x'.repeat(64)]) {
      assert.equal(sha256Hex(text), createHash('sha256').update(text).digest('hex'), text);
      assert.equal(sha256Hex(new TextEncoder().encode(text)), createHash('sha256').update(text).digest('hex'));
    }
  });
});
