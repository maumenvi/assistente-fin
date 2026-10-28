import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { AGENT_ERROR_MESSAGES } from '../../../../src/app/agent/errors/agent.error.messages.ts';
import { CONNECTION_STEP_IDS } from '../../../../src/domain/agent/connection/connection.step.id.ts';
import { CONTEXT_REQUIREMENTS } from '../../../../src/domain/agent/connection/context.requirements.ts';
import { ContextTooSmallError } from '../../../../src/domain/agent/errors/context.too.small.error.ts';
import { LlmKeyExpiredError } from '../../../../src/domain/agent/errors/llm.key.expired.error.ts';

describe('tipos do relatorio de conexao', () => {
  it('as 5 etapas na ordem e os limites de contexto', () => {
    assert.deepEqual([...CONNECTION_STEP_IDS], ['reach', 'key', 'model', 'tools', 'context']);
    assert.equal(CONTEXT_REQUIREMENTS.minTokens, 8192);
    assert.equal(CONTEXT_REQUIREMENTS.recommendedTokens, 16384);
  });

  it('novos erros tem codigo e mensagem pt-BR', () => {
    const expired = new LlmKeyExpiredError();
    assert.equal(expired.code, 'LLM_KEY_EXPIRED');
    assert.equal(expired.retriable, false);
    const small = new ContextTooSmallError(4096, 8192);
    assert.equal(small.code, 'CONTEXT_TOO_SMALL');
    assert.equal(small.detectedTokens, 4096);
    for (const code of [expired.code, small.code]) assert.ok((AGENT_ERROR_MESSAGES[code] ?? '').length > 10);
  });
});
