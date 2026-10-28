import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { END } from '../../../src/app/agent/graph/end.ts';
import { answerNode } from '../../../src/app/agent/graph/nodes/answer.node.ts';
import { countingLlm, makeNodeHarness } from './support/node.harness.ts';

async function messageOf(h: Awaited<ReturnType<typeof makeNodeHarness>>) {
  const all = await h.store.messages.list('u1', 'c1', { limit: 10 });
  return all.find((m) => m.id === 'r1-a');
}

describe('answer node', () => {
  it('write_request e out_of_scope: texto fixo, nenhuma chamada de LLM, so a mensagem do assistente muda', async () => {
    for (const [intent, kind] of [['write_request', 'canned_write'], ['out_of_scope', 'canned_scope']] as const) {
      const main = countingLlm('nao deveria');
      const h = await makeNodeHarness({ main, state: { intent } });
      const before = await h.store.messages.list('u1', 'c1', { limit: 10 });
      const result = await answerNode.run(h.state, h.node);
      assert.equal(result.next, END);
      assert.equal(main.calls, 0);
      const message = await messageOf(h);
      assert.equal(message?.status, 'complete');
      assert.equal(message?.parts[0]?.type, 'notice');
      assert.equal((message?.parts[0] as { kind: string }).kind, kind);
      assert.equal(result.state.finalText, (message?.parts[0] as { text: string }).text);
      const after = await h.store.messages.list('u1', 'c1', { limit: 10 });
      assert.equal(after.length, before.length);
      assert.deepEqual(after.find((m) => m.id === 'r1-u'), before.find((m) => m.id === 'r1-u'));
      assert.equal(h.emitted.filter((e) => e.type === 'notice').length, 1);
    }
  });

  it('write_request cita as telas Extrato e Registrar', async () => {
    const h = await makeNodeHarness({ state: { intent: 'write_request' } });
    const result = await answerNode.run(h.state, h.node);
    assert.match(result.state.finalText ?? '', /Extrato/);
  });

  it('settings_request: texto fixo + botao para a configuracao, sem LLM', async () => {
    const main = countingLlm('nao deveria');
    const h = await makeNodeHarness({ main, userText: 'ative a aprovação automática', state: { intent: 'settings_request' } });
    const result = await answerNode.run(h.state, h.node);
    assert.equal(main.calls, 0);
    const notice = (await messageOf(h))?.parts[0] as { kind: string; action?: { label: string; route: string } };
    assert.equal(notice.kind, 'settings_shortcut');
    assert.deepEqual(notice.action, { label: 'Abrir configurações', route: '/assistente/configuracao' });
    assert.match(result.state.finalText ?? '', /tela de configurações/);
  });

  it('direct: responde com o modelo rapido, sem ferramentas, publicando os pedacos', async () => {
    const fast = countingLlm('Olá! Posso consultar seus gastos.');
    const h = await makeNodeHarness({ fast, userText: 'oi', state: { intent: 'direct' } });
    const result = await answerNode.run(h.state, h.node);
    assert.equal(fast.calls, 1);
    assert.equal(result.state.finalText, 'Olá! Posso consultar seus gastos.');
    assert.deepEqual(h.emitted.filter((e) => e.type === 'text_delta').map((e) => (e as { text: string }).text), ['Olá! Posso consultar seus gastos.']);
    const message = await messageOf(h);
    assert.deepEqual(message?.parts, [{ type: 'text', text: 'Olá! Posso consultar seus gastos.' }]);
    assert.equal(result.detail?.role, 'fast');
  });

  it('direct sem modelo rapido cai para o principal', async () => {
    const main = countingLlm('Oi!');
    const h = await makeNodeHarness({ main, userText: 'oi', state: { intent: 'direct' } });
    const result = await answerNode.run(h.state, h.node);
    assert.equal(main.calls, 1);
    assert.equal(result.detail?.role, 'main');
  });
});
