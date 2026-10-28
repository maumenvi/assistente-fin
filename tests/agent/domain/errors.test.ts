import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { AgentConfigCorruptedError } from '../../../src/domain/agent/errors/agent.config.corrupted.error.ts';
import { AgentError } from '../../../src/domain/agent/errors/agent.error.ts';
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
import { DomainError } from '../../../src/domain/shared/domain.error.ts';

const errors: AgentError[] = [
  new AgentConfigCorruptedError('envelope'),
  new BudgetExceededError('steps'),
  new ConsentRequiredError(),
  new LlmAuthError(),
  new LlmModelNotFoundError(),
  new LlmProtocolError(),
  new LlmQuotaError(),
  new LlmRateLimitedError(1200),
  new LlmUnavailableError(),
  new LocalOnlyViolationError(),
  new NoModelConfiguredError(),
  new RunAlreadyActiveError(),
  new RunCancelledError(),
  new ToolFailedError('query_transactions'),
];

describe('erros do agente', () => {
  it('todos sao erros de dominio com codigo unico e estavel', () => {
    const codes = errors.map((e) => e.code);
    assert.equal(new Set(codes).size, codes.length);
    for (const error of errors) {
      assert.ok(error instanceof DomainError);
      assert.match(error.code, /^[A-Z_]+$/);
    }
  });

  it('so rede e limite de taxa sao retentaveis', () => {
    const retriable = errors.filter((e) => e.retriable).map((e) => e.code).sort();
    assert.deepEqual(retriable, ['LLM_RATE_LIMITED', 'LLM_UNAVAILABLE']);
  });

  it('erros de LLM dizem se ja saiu conteudo', () => {
    assert.equal(new LlmUnavailableError('x').emittedContent, false);
    assert.equal(new LlmUnavailableError('x', true).emittedContent, true);
    assert.equal(new LlmAuthError(true).emittedContent, true);
  });

  it('campos especificos', () => {
    assert.equal(new LlmRateLimitedError(1200).retryAfterMs, 1200);
    assert.equal(new LlmRateLimitedError().retryAfterMs, null);
    assert.equal(new BudgetExceededError('cost').which, 'cost');
    assert.equal(new ToolFailedError('t').tool, 't');
  });

  it('mantem o nome da subclasse', () => {
    assert.equal(new ConsentRequiredError().name, 'ConsentRequiredError');
  });
});
