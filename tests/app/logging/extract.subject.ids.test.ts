import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractSubjectIds } from '../../../src/app/logging/extract.subject.ids.ts';

test('extrai chaves Id/Ids com string ou lista de strings', () => {
  assert.deepEqual(
    extractSubjectIds({ transactionId: 't1', accountIds: ['a', 'b'], name: 'x', amountCents: 1, parentId: 3 }),
    { transactionId: 't1', accountIds: 'a,b' },
  );
});

test('args que nao e objeto devolve vazio', () => {
  assert.deepEqual(extractSubjectIds(undefined), {});
  assert.deepEqual(extractSubjectIds('x'), {});
  assert.deepEqual(extractSubjectIds([]), {});
});
