import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseAgentBlock } from '../../../../src/app/ai-exchange/format/parse.agent.block.ts';
import { AiBlockInvalidError } from '../../../../src/app/ai-exchange/errors/ai.block.invalid.error.ts';

function block(ops: unknown[], extra: Record<string, unknown> = {}) {
  return { batchId: 'lote-0001', ops, ...extra };
}

const create = { ref: 'a1', kind: 'create', entity: 'transaction', data: { amountCents: 100 } };

test('aceita um bloco valido com criar, ajustar, pagar e apagar confirmado', () => {
  const parsed = parseAgentBlock(
    block([
      create,
      { kind: 'update', entity: 'transaction', id: 'tx1', data: { categoryId: 'c1' }, expectV: '2026-10-10T12:00:00Z' },
      { kind: 'pay', entity: 'fixedExpense', id: 'fx1' },
      { kind: 'delete', entity: 'income', id: 'in1', confirm: true },
    ]),
  );
  assert.equal(parsed.ops.length, 4);
});

function issues(raw: unknown) {
  try {
    parseAgentBlock(raw);
  } catch (error) {
    assert.ok(error instanceof AiBlockInvalidError);
    return error.issues;
  }
  assert.fail('devia recusar');
}

test('batchId fora de 8-64 caracteres ou com simbolos e recusado', () => {
  assert.ok(issues(block([create], { batchId: 'curto' })).length > 0);
  assert.ok(issues(block([create], { batchId: 'x'.repeat(65) })).length > 0);
  assert.ok(issues(block([create], { batchId: 'lote com espaco' })).length > 0);
});

test('lista de operacoes vazia, com mais de 500 itens ou campo desconhecido e recusada', () => {
  assert.ok(issues(block([])).length > 0);
  const many = Array.from({ length: 501 }, (_, i) => ({ ...create, ref: `r${i}` }));
  assert.ok(issues(block(many)).length > 0);
  assert.ok(issues(block([create], { extra: 1 })).length > 0);
  assert.ok(issues(block([{ ...create, surprise: true }])).length > 0);
});

test('create exige ref e data; ref repetido e recusado', () => {
  assert.equal(issues(block([{ kind: 'create', entity: 'transaction', data: {} }]))[0]?.path, 'ref');
  assert.equal(issues(block([{ ref: 'a', kind: 'create', entity: 'transaction' }]))[0]?.path, 'data');
  const repeated = issues(block([create, { ...create }]));
  assert.equal(repeated[0]?.opIndex, 1);
  assert.equal(repeated[0]?.message, 'ref repetido no lote');
});

test('update, pay, delete e cancelRemaining exigem id; confirm so aceita true', () => {
  assert.equal(issues(block([{ kind: 'update', entity: 'transaction', data: {} }]))[0]?.path, 'id');
  assert.equal(issues(block([{ kind: 'delete', entity: 'transaction' }]))[0]?.path, 'id');
  assert.equal(issues(block([{ kind: 'cancelRemaining', entity: 'installmentPurchase' }]))[0]?.path, 'id');
  assert.ok(issues(block([{ kind: 'delete', entity: 'transaction', id: 'tx1', confirm: false }])).length > 0);
});

test('delete sem confirm passa na forma: quem o recusa e o plano, e as demais operacoes seguem (US3, cenario 1)', () => {
  const parsed = parseAgentBlock(block([create, { kind: 'delete', entity: 'transaction', id: 'tx1' }]));
  assert.equal(parsed.ops[1]?.confirm, undefined);
});

test('combinacao entidade e operacao fora da matriz da v1 e recusada', () => {
  assert.ok(issues(block([{ kind: 'delete', entity: 'category', id: 'c1', confirm: true }])).length > 0);
  assert.ok(issues(block([{ kind: 'pay', entity: 'transaction', id: 't1' }])).length > 0);
  assert.ok(issues(block([{ kind: 'cancelRemaining', entity: 'transaction', id: 't1', confirm: true }])).length > 0);
  assert.ok(issues(block([{ kind: 'create', entity: 'account', ref: 'a', data: {} }])).length > 0);
});

test('texto livre acima de 200 caracteres e recusado sem repetir o texto', () => {
  const found = issues(block([{ ...create, data: { notes: 'x'.repeat(201) } }]));
  assert.equal(found[0]?.opIndex, 0);
  assert.ok(!found[0]?.message.includes('xxxx'));
});

test('expectV precisa ser uma data ISO', () => {
  assert.ok(issues(block([{ kind: 'update', entity: 'transaction', id: 't1', data: {}, expectV: 'ontem' }])).length > 0);
});
