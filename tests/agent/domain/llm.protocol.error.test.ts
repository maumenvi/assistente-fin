import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { LlmProtocolError } from '../../../src/domain/agent/errors/llm.protocol.error.ts';
import { describeAgentError } from '../../../src/app/agent/errors/describe.agent.error.ts';

describe('LlmProtocolError (spec 037, FR-017)', () => {
  it('sem etapa mantem o codigo generico', () => {
    const error = new LlmProtocolError('x', false);
    assert.equal(error.code, 'LLM_PROTOCOL');
    assert.equal(error.stage, null);
  });

  it('cada etapa tem codigo proprio e mensagem especifica diferente da generica', () => {
    const generic = describeAgentError('LLM_PROTOCOL');
    const messages = new Set<string>();
    for (const stage of ['chunk_invalido', 'fim_inesperado', 'sem_saida'] as const) {
      const error = new LlmProtocolError('detalhe tecnico', true, stage);
      assert.equal(error.stage, stage);
      assert.equal(error.emittedContent, true);
      const text = describeAgentError(error.code);
      assert.notEqual(text, generic);
      assert.match(text, /outro modelo/);
      messages.add(text);
    }
    assert.equal(messages.size, 3);
  });
});
