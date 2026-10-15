import { test } from 'node:test';
import assert from 'node:assert/strict';
import { agentPayloadSchema } from '../../../../src/app/ai-exchange/format/agent.payload.schema.ts';
import { TRANSACTION_COLUMNS } from '../../../../src/app/ai-exchange/format/agent.payload.ts';

const valid = {
  format: 'finctrl-payload',
  version: 1,
  snapshot: { id: 's-1', at: '2026-10-15T21:40:00Z' },
  scope: { from: '2026-08-02', to: '2026-10-15', accounts: 'all', approx: false, descriptionsOmitted: false },
  catalog: { accounts: [], categories: [], limits: [], fixedExpenses: [], incomes: [] },
  transactions: { cols: [...TRANSACTION_COLUMNS], rows: [['tx1', '2026-10-10T12:00:00Z', '2026-10-13', 'expense', 2350, 'Padaria', 'a1', 'c1', null, null, null]] },
};

test('aceita o conteudo do contrato (parte unica, com cadastros)', () => {
  assert.ok(agentPayloadSchema.safeParse(valid).success);
});

test('aceita uma parte seguinte, sem cadastros', () => {
  const { catalog: _catalog, ...rest } = valid;
  assert.ok(agentPayloadSchema.safeParse({ ...rest, part: { index: 2, count: 3 } }).success);
});

test('recusa marca, versao ou celula fora do formato', () => {
  assert.equal(agentPayloadSchema.safeParse({ ...valid, format: 'outro' }).success, false);
  assert.equal(agentPayloadSchema.safeParse({ ...valid, version: 2 }).success, false);
  assert.equal(agentPayloadSchema.safeParse({ ...valid, transactions: { cols: ['a'], rows: [[{ x: 1 }]] } }).success, false);
});
