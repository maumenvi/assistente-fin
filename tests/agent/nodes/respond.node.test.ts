import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { END } from '../../../src/app/agent/graph/end.ts';
import { respondNode } from '../../../src/app/agent/graph/nodes/respond.node.ts';
import { type Fact } from '../../../src/domain/agent/fact.ts';
import { makeNodeHarness } from './support/node.harness.ts';

const fact: Fact = { id: 'f1', kind: 'money', value: 128_460, display: 'R$ 1.284,60', label: 'total de mercado', sourceCallId: 'c1' };
const summary = { tool: 'query_transactions', label: 'lançamentos de set/2026', filters: {}, itemCount: 38, truncated: false };

async function saved(h: Awaited<ReturnType<typeof makeNodeHarness>>) {
  return (await h.store.messages.list('u1', 'c1', { limit: 5 })).find((m) => m.id === 'r1-a');
}

describe('respond node', () => {
  it('valor correto passa: grava cartao + texto como complete e termina', async () => {
    const h = await makeNodeHarness({ state: { ledger: [fact], summaries: [summary], finalText: 'Você gastou R$ 1.284,60 com mercado em set/2026.' } });
    const result = await respondNode.run(h.state, h.node);
    assert.equal(result.next, END);
    const message = await saved(h);
    assert.equal(message?.status, 'complete');
    assert.deepEqual(message?.parts.map((p) => p.type), ['query', 'text']);
    assert.equal(h.emitted.some((e) => e.type === 'message_replaced'), false);
  });

  it('valor inventado: corrige 1x voltando ao react com a lista de valores permitidos', async () => {
    const h = await makeNodeHarness({ state: { ledger: [fact], finalText: 'Você gastou R$ 999,00 com mercado.' } });
    const result = await respondNode.run(h.state, h.node);
    assert.equal(result.next, 'react');
    assert.equal(result.state.counters.correctionAttempts, 1);
    assert.equal(result.state.finalText, null);
    const note = result.state.turnMessages.at(-1);
    const noteText = note?.role === 'user' ? note.content.map((p) => (p.type === 'text' ? p.text : '')).join('') : '';
    assert.match(noteText, /R\$ 999,00/);
    assert.match(noteText, /R\$ 1\.284,60/);
    assert.equal(h.emitted.filter((e) => e.type === 'message_replaced').length, 1);
    assert.equal((await saved(h))?.status, 'streaming');
  });

  it('persistindo apos a correcao: mascara o valor e marca figures_unverified', async () => {
    const h = await makeNodeHarness({
      state: { ledger: [fact], finalText: 'Você gastou R$ 999,00 com mercado.', counters: { llmCalls: 2, toolCalls: 1, correctionAttempts: 1, argRepairAttempts: 0 } },
    });
    const result = await respondNode.run(h.state, h.node);
    assert.equal(result.next, END);
    assert.equal(result.state.finalText, 'Você gastou (valor não confirmado) com mercado.');
    const message = await saved(h);
    assert.ok(message?.parts.some((p) => p.type === 'notice' && p.kind === 'figures_unverified'));
    assert.equal(message?.status, 'complete');
    assert.equal(h.emitted.filter((e) => e.type === 'message_replaced').length, 1);
  });

  it('valor escrito pelo proprio usuario na pergunta passa', async () => {
    const h = await makeNodeHarness({ userText: 'gastei R$ 50,00 ontem, isso passa do limite?', state: { finalText: 'Os R$ 50,00 que você citou entram no cálculo.' } });
    const result = await respondNode.run(h.state, h.node);
    assert.equal(result.next, END);
    assert.equal(result.state.finalText, 'Os R$ 50,00 que você citou entram no cálculo.');
  });

  it('ausencia de dados: "nao encontrei" sem numeros nao e tratada como invencao', async () => {
    const h = await makeNodeHarness({ state: { finalText: 'Não encontrei lançamentos de mercado em set/2026.' } });
    const result = await respondNode.run(h.state, h.node);
    assert.equal(result.next, END);
  });

  it('texto vazio vira uma mensagem padrao; avisos acumulados entram na mensagem', async () => {
    const notice = { type: 'notice' as const, kind: 'no_tools' as const, text: 'sem ferramentas' };
    const h = await makeNodeHarness({ state: { finalText: '', notices: [notice] } });
    await respondNode.run(h.state, h.node);
    const message = await saved(h);
    assert.match(message?.parts.find((p) => p.type === 'text')?.type === 'text' ? (message.parts.find((p) => p.type === 'text') as { text: string }).text : '', /O modelo não devolveu uma resposta/);
    assert.ok(message?.parts.some((p) => p.type === 'notice' && p.kind === 'no_tools'));
  });
});
