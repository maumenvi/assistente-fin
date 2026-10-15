import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatImportErrors } from '../../../../src/app/ai-exchange/import/format.import.errors.ts';

test('lista os problemas por item e termina lembrando o formato, sem valores do usuario', () => {
  const text = formatImportErrors([
    { opIndex: 1, path: 'data.categoryId', message: 'categoria nao encontrada: use um id de categoria dos dados enviados' },
    { opIndex: 2, path: 'data.amountCents', message: 'valor deve ser positivo' },
    { opIndex: -1, path: '', message: 'ha mais de um bloco; devolva um unico bloco' },
  ]);
  assert.match(text, /3 problema\(s\)/);
  assert.match(text, /- Item 2 \(data\.categoryId\): categoria nao encontrada/);
  assert.match(text, /- Item 3 \(data\.amountCents\)/);
  assert.match(text, /- No bloco: ha mais de um bloco/);
  assert.match(text, /FINCTRL-IMPORT v1/);
  assert.match(text, /batchId novo/);
});

test('limita a lista e conta o resto', () => {
  const many = Array.from({ length: 20 }, (_, index) => ({ opIndex: index, path: 'id', message: 'x' }));
  const text = formatImportErrors(many);
  assert.match(text, /e mais 8 problema\(s\)/);
  assert.equal(text.split('\n').filter((line) => line.startsWith('- Item')).length, 12);
});
