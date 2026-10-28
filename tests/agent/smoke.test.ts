import assert from 'node:assert/strict';
import { test } from 'node:test';

// Garante que o `npm test` descobre a pasta tests/agent (spec 031, T001).
test('descoberta de testes do agente', () => {
  assert.equal(1 + 1, 2);
});
