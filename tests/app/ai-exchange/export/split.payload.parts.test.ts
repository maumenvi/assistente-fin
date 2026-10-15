import { test } from 'node:test';
import assert from 'node:assert/strict';
import { splitPayloadParts } from '../../../../src/app/ai-exchange/export/split.payload.parts.ts';
import { type AgentPayload, type AgentCell, TRANSACTION_COLUMNS } from '../../../../src/app/ai-exchange/format/agent.payload.ts';

function payloadWith(rowCount: number): AgentPayload {
  const rows: AgentCell[][] = Array.from({ length: rowCount }, (_, index) => {
    const day = String(28 - Math.floor(index / 3)).padStart(2, '0');
    return [`tx${index}`, null, `2026-10-${day}`, 'expense', 1000 + index, `compra ${index}`, 'a1', 'c1', null, null, null];
  });
  return {
    format: 'finctrl-payload',
    version: 1,
    snapshot: { id: 's-1', at: '2026-10-28T12:00:00.000Z' },
    scope: { from: null, to: '2026-10-28', accounts: 'all', approx: false, descriptionsOmitted: false },
    catalog: { accounts: [], categories: [], limits: [], fixedExpenses: [], incomes: [] },
    transactions: { cols: [...TRANSACTION_COLUMNS], rows },
  };
}

const BUDGET = 20_000;

test('cabendo tudo, uma parte so, sem campo part, com periodo coberto (spec 029, FR-011)', () => {
  const result = splitPayloadParts(payloadWith(10), null, BUDGET);
  assert.equal(result.parts.length, 1);
  assert.equal(result.remaining, 0);
  assert.equal(result.covered.count, 10);
  assert.equal(result.parts[0]!.payload.part, undefined);
  assert.ok(result.parts[0]!.text.length <= BUDGET);
});

test('nao cabendo, parte em textos numerados, todos dentro do orcamento e com o mesmo snapshot', () => {
  const result = splitPayloadParts(payloadWith(600), null, BUDGET);
  assert.ok(result.parts.length > 1);
  assert.equal(result.remaining, result.parts.length - 1);
  result.parts.forEach((part, position) => {
    assert.equal(part.index, position + 1);
    assert.equal(part.count, result.parts.length);
    assert.ok(part.text.length <= BUDGET, `parte ${part.index} passou do orcamento: ${part.text.length}`);
    assert.equal(part.payload.snapshot.id, 's-1');
    assert.equal(part.payload.part?.index, part.index);
  });
  assert.ok(result.parts[0]!.payload.catalog !== undefined, 'a parte 1 leva os cadastros');
  assert.ok(result.parts.slice(1).every((part) => part.payload.catalog === undefined));
  assert.match(result.parts[1]!.text, /Parte 2 de/);
});

test('nenhuma linha se perde nem se repete, e a ordem e a das mais recentes primeiro', () => {
  const total = 450;
  const result = splitPayloadParts(payloadWith(total), null, BUDGET);
  const ids = result.parts.flatMap((part) => part.payload.transactions.rows.map((row) => row[0]));
  assert.equal(ids.length, total);
  assert.deepEqual(ids, Array.from({ length: total }, (_, index) => `tx${index}`));
  assert.equal(result.totalRows, total);
});

test('cada parte e um JSON valido depois do cabecalho (nunca corta uma linha no meio)', () => {
  const result = splitPayloadParts(payloadWith(300), null, BUDGET);
  for (const part of result.parts) {
    const json = part.text.slice(part.text.indexOf('[Dados]') + '[Dados]'.length).trim();
    const parsed = JSON.parse(json) as AgentPayload;
    assert.equal(parsed.transactions.rows.length, part.rowCount);
  }
});

test('o periodo coberto vai do dado mais antigo ao mais novo da parte 1', () => {
  const result = splitPayloadParts(payloadWith(600), null, BUDGET);
  assert.equal(result.covered.to, '2026-10-28');
  assert.ok(result.covered.from !== null && result.covered.from < '2026-10-28');
  assert.equal(result.covered.count, result.parts[0]!.rowCount);
});

test('cadastros maiores que o orcamento: parte 1 sem transacoes, o resto nas seguintes', () => {
  const payload = payloadWith(30);
  const bigCatalog = { ...payload, catalog: { ...payload.catalog!, categories: Array.from({ length: 800 }, (_, i) => ({ id: `c${i}`, name: `Categoria numero ${i}`, isDefault: false })) } };
  const result = splitPayloadParts(bigCatalog, null, BUDGET);
  assert.equal(result.parts[0]!.rowCount, 0);
  assert.equal(result.parts.slice(1).reduce((sum, part) => sum + part.rowCount, 0), 30);
});

test('sem nenhuma transacao: uma parte com os cadastros e periodo vazio', () => {
  const result = splitPayloadParts(payloadWith(0), null, BUDGET);
  assert.equal(result.parts.length, 1);
  assert.equal(result.covered.count, 0);
  assert.equal(result.covered.from, null);
});
