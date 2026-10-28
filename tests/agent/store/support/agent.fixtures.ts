import { type AgentMessage } from '../../../../src/domain/agent/agent.message.ts';
import { type AgentRun } from '../../../../src/domain/agent/agent.run.ts';
import { type Conversation } from '../../../../src/domain/agent/conversation.ts';
import { DEFAULT_RUN_BUDGET } from '../../../../src/domain/agent/default.run.budget.ts';
import { EMPTY_CONSUMED } from '../../../../src/domain/agent/empty.consumed.ts';
import { type RunStep } from '../../../../src/domain/agent/run.step.ts';
import { type NewAgentMessage } from '../../../../src/app/agent/ports/store/new.agent.message.ts';

/** Instante fixo mais `n` minutos, em ISO. */
export function at(minute: number): string {
  return new Date(Date.UTC(2026, 9, 22, 12, minute, 0)).toISOString();
}

export function makeConversation(id: string, userId: string, overrides: Partial<Conversation> = {}): Conversation {
  return { id, userId, title: `Conversa ${id}`, status: 'active', createdAt: at(0), updatedAt: at(0), lastMessageAt: at(0), ...overrides };
}

export function makeNewMessage(id: string, conversationId: string, userId: string, overrides: Partial<NewAgentMessage> = {}): NewAgentMessage {
  return {
    id, conversationId, userId, role: 'user', parts: [{ type: 'text', text: `texto ${id}` }],
    status: 'complete', runId: null, errorCode: null, createdAt: at(1), ...overrides,
  };
}

export function makeRun(id: string, conversationId: string, userId: string, overrides: Partial<AgentRun> = {}): AgentRun {
  return {
    id, conversationId, userId, userMessageId: `${id}-u`, assistantMessageId: `${id}-a`, status: 'running',
    currentNode: 'route', intent: null, budget: DEFAULT_RUN_BUDGET, consumed: EMPTY_CONSUMED,
    profileIds: { main: 'p-main', fast: null, fallbackUsed: false }, model: 'anthropic/claude-sonnet',
    state: { cursor: 'route', ledger: [] }, startedAt: at(2), endedAt: null, heartbeatAt: at(2), errorCode: null, ...overrides,
  };
}

export function makeStep(runId: string, seq: number, overrides: Partial<RunStep> = {}): RunStep {
  return {
    id: `${runId}-s${seq}`, runId, seq, node: 'react', fromNode: 'route', toNode: 'tools', status: 'ok',
    startedAt: at(3), durationMs: 120, role: 'main', model: 'anthropic/claude-sonnet', inputTokens: 100,
    outputTokens: 20, cachedTokens: 0, costMicroUsd: 400,
    toolCalls: [{ id: 'c1', name: 'query_transactions', args: { month: '2026-09' }, resultSummary: '38 itens', ms: 12, truncated: false }],
    request: { messages: ['oi'] }, response: { text: 'ok' }, truncated: false, error: null, ...overrides,
  };
}

export type { AgentMessage };
