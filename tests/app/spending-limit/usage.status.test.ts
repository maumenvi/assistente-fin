import { test } from 'node:test';
import assert from 'node:assert/strict';
import { usageStatus } from '../../../src/app/spending-limit/usage.status.ts';

/** Regra unica de cor (spec 023, FR-002): igual a da tela Inicio. */
test('79 normal, 80 atencao, 99 atencao, 100 estourado, 101 estourado', () => {
  assert.deepEqual([79, 80, 99, 100, 101].map(usageStatus), ['normal', 'warning', 'warning', 'over', 'over']);
});
