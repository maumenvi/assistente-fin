import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findOperationHandler, listOperationHandlers } from '../../../../src/app/ai-exchange/import/handler.registry.ts';
import { AGENT_OP_MATRIX } from '../../../../src/app/ai-exchange/format/agent.op.matrix.ts';
import { AGENT_ENTITIES } from '../../../../src/app/ai-exchange/format/agent.entity.ts';

test('toda combinacao aceita pela forma do bloco tem handler, e todo handler esta na matriz', () => {
  for (const entity of AGENT_ENTITIES) {
    for (const kind of AGENT_OP_MATRIX[entity]) {
      assert.ok(findOperationHandler(entity, kind), `sem handler para ${entity}:${kind}`);
    }
  }
  for (const handler of listOperationHandlers()) {
    assert.ok(AGENT_OP_MATRIX[handler.entity].includes(handler.kind), `${handler.entity}:${handler.kind} fora da matriz`);
  }
});

test('combinacao fora da v1 nao tem handler', () => {
  assert.equal(findOperationHandler('category', 'delete'), null);
  assert.equal(findOperationHandler('transaction', 'pay'), null);
});

test('esquemas de dados sao estritos: campo desconhecido e recusado em todo handler que recebe data', () => {
  for (const handler of listOperationHandlers()) {
    if (handler.dataSchema === null) continue;
    const result = handler.dataSchema.safeParse({ campoInexistente: 1 });
    assert.equal(result.success, false, `${handler.entity}:${handler.kind} aceitou campo desconhecido`);
  }
});

test('campos destrutivos so existem em handlers de update e pertencem ao esquema', () => {
  for (const handler of listOperationHandlers()) {
    if (handler.destructiveFields.length === 0) continue;
    assert.equal(handler.kind, 'update');
    const shape = (handler.dataSchema as { shape?: Record<string, unknown> }).shape ?? {};
    for (const field of handler.destructiveFields) assert.ok(field in shape, `${field} nao esta no esquema de ${handler.entity}`);
  }
});
