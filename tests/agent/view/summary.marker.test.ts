import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { type AgentEvent } from '../../../src/app/agent/ports/events/agent.event.ts';
import { GetConversationSummaryUseCase } from '../../../src/app/agent/use-cases/get.conversation.summary.use.case.ts';
import { addUserMessage } from '../../../src/app/agent/view/add.user.message.ts';
import { emptyChatState } from '../../../src/app/agent/view/empty.chat.state.ts';
import { reduceChat } from '../../../src/app/agent/view/reduce.chat.ts';
import { buildSummaryView, summaryMarkerTitle } from '../../../src/app/agent/view/summary.view.ts';
import { InvalidInputError } from '../../../src/app/shared/invalid.input.error.ts';
import { FakeAgentStore } from '../../../src/database/fake/agent.store.fake.ts';
import { type ConversationSummary } from '../../../src/domain/agent/summary/conversation.summary.ts';
import { makeConversation } from '../store/support/agent.fixtures.ts';

const NOW = new Date('2026-10-22T12:00:00Z');
const summary: ConversationSummary = {
  id: 's1', userId: 'u1', conversationId: 'c1', coveredFromSeq: 1, coveredToSeq: 120, modelProfileId: 'p', tokensEstimate: 100, generation: 2, createdAt: '2026-10-22T09:00:00Z',
  content: { goal: 'Revisar setembro.', decisions: ['comparar com agosto'], entities: [{ kind: 'account', id: 'a1', label: 'Nubank' }, { kind: 'period', id: '2026-09', label: 'setembro' }], pending: [], openPlans: [] },
};

describe('visao do resumo (somente leitura)', () => {
  it('titulo do separador e secoes sem as vazias, com o lembrete de que valores nao ficam no resumo', () => {
    assert.equal(summaryMarkerTitle(1, 120), 'Contexto resumido · mensagens 1 a 120');
    const view = buildSummaryView(summary, NOW);
    assert.equal(view.title, 'Contexto resumido · mensagens 1 a 120');
    assert.deepEqual(view.sections.map((s) => s.label), ['Objetivo', 'Decisões', 'Entidades']);
    assert.deepEqual(view.sections[2]?.items, ['Nubank (conta)', 'setembro (período)']);
    assert.equal(view.generatedLabel, 'gerado hoje');
    assert.match(view.note, /Valores não ficam no resumo/);
  });
});

describe('reducer do evento summary_updated', () => {
  const ev = (runId: string, seq: number, body: Record<string, unknown>): AgentEvent => ({ runId, conversationId: 'c1', seq, ...body }) as AgentEvent;
  const finished = [
    ev('r1', 1, { type: 'run_started', userMessageId: 'u', assistantMessageId: 'a' }),
    ev('r1', 2, { type: 'text_delta', messageId: 'a', text: 'Oi!' }),
    ev('r1', 3, { type: 'run_finished', status: 'done', consumed: {}, error: null }),
  ].reduce(reduceChat, addUserMessage({ ...emptyChatState(), conversationId: 'c1' }, { id: 'u', text: 'oi' }));

  it('poe a marca na mensagem do corte e a move quando o resumo e refeito (uma so)', () => {
    const first = reduceChat(finished, ev('r1:compact', 1, { type: 'summary_updated', messageId: 'a', summaryId: 's1', coveredFromSeq: 1, coveredToSeq: 2 }));
    assert.deepEqual(first.messages.find((m) => m.id === 'a')?.parts.at(-1), { type: 'summary_marker', summaryId: 's1', coveredFromSeq: 1, coveredToSeq: 2 });
    const second = reduceChat(first, ev('r2:compact', 1, { type: 'summary_updated', messageId: 'u', summaryId: 's2', coveredFromSeq: 1, coveredToSeq: 9 }));
    const markers = second.messages.flatMap((m) => m.parts.filter((p) => p.type === 'summary_marker'));
    assert.equal(markers.length, 1);
    assert.equal(markers[0]?.type === 'summary_marker' ? markers[0].summaryId : '', 's2');
  });
});

describe('GetConversationSummaryUseCase', () => {
  it('devolve o resumo corrente do dono e null para outro usuario ou sem compactacao', async () => {
    const store = new FakeAgentStore();
    await store.conversations.create(makeConversation('c1', 'u1'));
    const useCase = new GetConversationSummaryUseCase(store);
    assert.equal(await useCase.execute({ userId: 'u1', conversationId: 'c1' }), null);
    await store.summaries.replaceCurrent(summary);
    assert.equal((await useCase.execute({ userId: 'u1', conversationId: 'c1' }))?.id, 's1');
    assert.equal(await useCase.execute({ userId: 'u2', conversationId: 'c1' }), null);
    await assert.rejects(useCase.execute({ userId: '', conversationId: 'c1' }), InvalidInputError);
  });
});
