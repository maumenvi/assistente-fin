import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { describeAgentError } from '../../../src/app/agent/errors/describe.agent.error.ts';
import { AgentConfigCorruptedError } from '../../../src/domain/agent/errors/agent.config.corrupted.error.ts';
import { BudgetExceededError } from '../../../src/domain/agent/errors/budget.exceeded.error.ts';
import { ConsentRequiredError } from '../../../src/domain/agent/errors/consent.required.error.ts';
import { LlmAuthError } from '../../../src/domain/agent/errors/llm.auth.error.ts';
import { LlmModelNotFoundError } from '../../../src/domain/agent/errors/llm.model.not.found.error.ts';
import { LlmProtocolError } from '../../../src/domain/agent/errors/llm.protocol.error.ts';
import { LlmQuotaError } from '../../../src/domain/agent/errors/llm.quota.error.ts';
import { LlmRateLimitedError } from '../../../src/domain/agent/errors/llm.rate.limited.error.ts';
import { LlmUnavailableError } from '../../../src/domain/agent/errors/llm.unavailable.error.ts';
import { LocalOnlyViolationError } from '../../../src/domain/agent/errors/local.only.violation.error.ts';
import { NoModelConfiguredError } from '../../../src/domain/agent/errors/no.model.configured.error.ts';
import { RunAlreadyActiveError } from '../../../src/domain/agent/errors/run.already.active.error.ts';
import { RunCancelledError } from '../../../src/domain/agent/errors/run.cancelled.error.ts';
import { ToolFailedError } from '../../../src/domain/agent/errors/tool.failed.error.ts';

const GENERIC = /Algo deu errado/;

describe('mensagens de erro do agente', () => {
  it('todo codigo de erro de dominio tem mensagem propria em pt-BR', () => {
    const errors = [
      new AgentConfigCorruptedError('x'), new BudgetExceededError('steps'), new ConsentRequiredError(), new LlmAuthError(),
      new LlmModelNotFoundError(), new LlmProtocolError('x'), new LlmQuotaError(), new LlmRateLimitedError(),
      new LlmUnavailableError(), new LocalOnlyViolationError(), new NoModelConfiguredError(), new RunAlreadyActiveError(),
      new RunCancelledError(), new ToolFailedError('t', 'm'),
    ];
    for (const error of errors) {
      const text = describeAgentError(error.code);
      assert.doesNotMatch(text, GENERIC, error.code);
      assert.ok(text.length > 10, error.code);
    }
    assert.equal(new Set(errors.map((e) => e.code)).size, errors.length);
  });

  it('offline tem mensagem; codigo desconhecido ou ausente cai na generica sem vazar detalhe', () => {
    assert.match(describeAgentError('OFFLINE'), /Sem conexão/);
    assert.match(describeAgentError('INTERNAL'), GENERIC);
    assert.match(describeAgentError(null), GENERIC);
  });
});
