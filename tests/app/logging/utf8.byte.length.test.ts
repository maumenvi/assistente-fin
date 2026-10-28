import { test } from 'node:test';
import assert from 'node:assert/strict';
import { utf8ByteLength } from '../../../src/app/logging/utf8.byte.length.ts';

test('confere com Buffer.byteLength para ASCII, acentos, CJK e emoji', () => {
  for (const text of ['', 'abc', 'Café do Zé', '日本語', 'compra 🛒 R$ 10,00', 'é€\u{1F600}']) {
    assert.equal(utf8ByteLength(text), Buffer.byteLength(text, 'utf8'), text);
  }
});
