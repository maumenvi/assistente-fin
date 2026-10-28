import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DEFAULT_RUN_BUDGET } from '../../../src/domain/agent/default.run.budget.ts';
import { INTENTS } from '../../../src/domain/agent/intent.ts';
import { MODEL_ORIGINS } from '../../../src/domain/agent/model.origin.ts';
import { MODEL_ROLES } from '../../../src/domain/agent/model.role.ts';
import { RUN_STATUSES } from '../../../src/domain/agent/run.status.ts';

describe('constantes basicas do agente', () => {
  it('orcamento padrao: 40 passos, 5 min e US$ 1,00 (ampliado na spec 040)', () => {
    assert.equal(DEFAULT_RUN_BUDGET.maxSteps, 40);
    assert.equal(DEFAULT_RUN_BUDGET.maxMs, 300_000);
    assert.equal(DEFAULT_RUN_BUDGET.maxCostMicroUsd, 1_000_000);
  });

  it('o orcamento padrao nao pode ser alterado', () => {
    assert.throws(() => {
      (DEFAULT_RUN_BUDGET as { maxSteps: number }).maxSteps = 99;
    }, TypeError);
  });

  it('estados de execucao incluem o reservado para a spec 033', () => {
    assert.deepEqual([...RUN_STATUSES], ['running', 'done', 'interrupted', 'failed', 'cancelled', 'awaiting_approval']);
  });

  it('intencoes incluem o pedido de mudar configuracoes', () => {
    assert.deepEqual([...INTENTS], ['direct', 'query', 'write_request', 'settings_request', 'preference', 'out_of_scope']);
  });

  it('papeis e origens de modelo', () => {
    assert.deepEqual([...MODEL_ROLES], ['main', 'fast', 'fallback']);
    assert.deepEqual([...MODEL_ORIGINS], ['openrouter', 'google', 'openai_compat_local']);
  });
});
