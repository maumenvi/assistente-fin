import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { partialAnswer } from '../../../src/app/agent/graph/nodes/partial.answer.ts';
import { type Fact } from '../../../src/domain/agent/fact.ts';
import { makeNodeHarness } from './support/node.harness.ts';

const fact: Fact = { id: 'f1', kind: 'money', value: 128_460, display: 'R$ 1.284,60', label: 'total', sourceCallId: 'c1' };
const summary = { tool: 'query_transactions', label: 'lançamentos de set/2026', filters: {}, itemCount: 38, truncated: false };
const assistant = (text: string) => ({ role: 'assistant' as const, content: [{ type: 'text' as const, text }] });

async function saved(h: Awaited<ReturnType<typeof makeNodeHarness>>) {
  return (await h.store.messages.list('u1', 'c1', { limit: 5 })).find((m) => m.id === 'r1-a');
}

describe('partial answer (onLimit)', () => {
  for (const [which, text] of [['steps', 'limite de passos'], ['time', 'limite de tempo'], ['cost', 'limite de custo']] as const) {
    it(`${which}: entrega o apurado com o aviso budget_reached`, async () => {
      const h = await makeNodeHarness({ state: { ledger: [fact], summaries: [summary], turnMessages: [{ role: 'user', content: [{ type: 'text', text: 'quanto gastei?' }] }, assistant('Até agora: R$ 1.284,60 em mercado.')] } });
      const state = await partialAnswer(h.state, which, h.node);
      const message = await saved(h);
      assert.equal(message?.status, 'complete');
      assert.deepEqual(message?.parts.map((p) => p.type), ['query', 'text', 'notice']);
      const notice = message?.parts.find((p) => p.type === 'notice');
      assert.equal(notice?.type === 'notice' && notice.kind, 'budget_reached');
      assert.match(notice?.type === 'notice' ? notice.text : '', new RegExp(text));
      assert.equal(state.finalText, 'Até agora: R$ 1.284,60 em mercado.');
      assert.equal(h.emitted.filter((e) => e.type === 'message_replaced').length, 1);
    });
  }

  it('nenhuma figura sem fato: valor nao confirmado e mascarado', async () => {
    const h = await makeNodeHarness({ state: { ledger: [fact], turnMessages: [{ role: 'user', content: [{ type: 'text', text: 'e agora?' }] }, assistant('Foram R$ 777,00 e R$ 1.284,60.')] } });
    const state = await partialAnswer(h.state, 'steps', h.node);
    assert.equal(state.finalText, 'Foram (valor não confirmado) e R$ 1.284,60.');
    const kinds = (await saved(h))?.parts.filter((p) => p.type === 'notice').map((p) => (p.type === 'notice' ? p.kind : ''));
    assert.deepEqual(kinds, ['figures_unverified', 'budget_reached']);
  });

  it('sem nenhum texto ainda: mensagem padrao em vez de vazio e pergunta se quer estender o limite (T033)', async () => {
    const h = await makeNodeHarness();
    const state = await partialAnswer(h.state, 'time', h.node);
    assert.match(state.finalText ?? '', /Não consegui concluir/);
    assert.match(state.finalText ?? '', /estender o limite/i);
  });

  it('declara o que faltou e pergunta se a pessoa quer estender o limite no aviso budget_reached (T033)', async () => {
    const h = await makeNodeHarness({
      state: {
        ledger: [fact],
        summaries: [summary],
        pendingToolCalls: [{ id: 'c2', name: 'calculate', args: { op: 'expr', expression: '1284,60 * 20%' } }],
        turnMessages: [
          { role: 'user', content: [{ type: 'text', text: 'quanto gastei e quanto economizo cortando 20%?' }] },
          assistant('Em setembro você gastou R$ 1.284,60.'),
        ],
      },
    });
    const state = await partialAnswer(h.state, 'steps', h.node);
    assert.equal(state.finalText, 'Em setembro você gastou R$ 1.284,60.');
    const message = await saved(h);
    const notice = message?.parts.find((p) => p.type === 'notice' && p.kind === 'budget_reached');
    assert.ok(notice && notice.type === 'notice');
    assert.match(notice.text, /Faltou concluir: calculate/i);
    assert.match(notice.text, /Quer estender o limite/i);
  });
});
