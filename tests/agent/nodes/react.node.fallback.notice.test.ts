import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ReplayLlm } from '../../../src/libs/llm/replay/replay.llm.ts';
import { reactNode } from '../../../src/app/agent/graph/nodes/react.node.ts';
import { LlmAuthError } from '../../../src/domain/agent/errors/llm.auth.error.ts';
import { LlmKeyExpiredError } from '../../../src/domain/agent/errors/llm.key.expired.error.ts';
import { LlmQuotaError } from '../../../src/domain/agent/errors/llm.quota.error.ts';
import { makeNodeHarness, TOOLS_CAPABILITIES } from './support/node.harness.ts';

const textTurn = (text: string) => ({ events: [{ type: 'text_delta' as const, text }, { type: 'finish' as const, reason: 'stop' as const }] });

describe('react: avisos de troca de modelo e de chave (spec 035)', () => {
  it('o alternativo respondeu => aviso fallback_used (uma vez), com o modelo, no estado e no evento', async () => {
    const main = new ReplayLlm(TOOLS_CAPABILITIES, [{ events: [], error: { code: 'LLM_UNAVAILABLE' } }]);
    const fallback = new ReplayLlm(TOOLS_CAPABILITIES, [textTurn('Resposta do alternativo.')]);
    const h = await makeNodeHarness({ main, fallback });
    const node = { ...h.node, fallbackModel: 'gemini-3.8-flash' };
    const result = await reactNode.run(h.state, node);
    const used = result.state.notices.filter((n) => n.kind === 'fallback_used');
    assert.equal(used.length, 1);
    assert.match(used[0]?.text ?? '', /\(gemini-3\.8-flash\)/);
    assert.equal(h.emitted.filter((e) => e.type === 'notice' && e.notice.kind === 'fallback_used').length, 1);
  });

  it('o principal respondeu => nenhum aviso de troca', async () => {
    const main = new ReplayLlm(TOOLS_CAPABILITIES, [textTurn('Do principal.')]);
    const fallback = new ReplayLlm(TOOLS_CAPABILITIES, [textTurn('nao deveria')]);
    const h = await makeNodeHarness({ main, fallback });
    const result = await reactNode.run(h.state, h.node);
    assert.deepEqual(result.state.notices, []);
    assert.equal(fallback.requests.length, 0);
  });

  it('sem alternativo, chave recusada/vencida/sem credito viram aviso na hora (e o erro propaga)', async () => {
    for (const [code, error, kind] of [['LLM_AUTH', LlmAuthError, 'key_rejected'], ['LLM_KEY_EXPIRED', LlmKeyExpiredError, 'key_expired'], ['LLM_QUOTA', LlmQuotaError, 'quota_exhausted']] as const) {
      const main = new ReplayLlm(TOOLS_CAPABILITIES, [{ events: [], error: { code } }]);
      const h = await makeNodeHarness({ main });
      await assert.rejects(reactNode.run(h.state, { ...h.node, providerName: 'OpenRouter' }), error);
      const notices = h.emitted.flatMap((e) => (e.type === 'notice' ? [e.notice] : []));
      assert.deepEqual(notices.map((n) => n.kind), [kind], code);
      assert.equal(notices[0]?.action?.label, 'Abrir configuração');
    }
  });

  it('chave recusada NAO troca de modelo em silencio: o alternativo nem e chamado', async () => {
    const main = new ReplayLlm(TOOLS_CAPABILITIES, [{ events: [], error: { code: 'LLM_AUTH' } }]);
    const fallback = new ReplayLlm(TOOLS_CAPABILITIES, [textTurn('nao deveria')]);
    const h = await makeNodeHarness({ main, fallback });
    await assert.rejects(reactNode.run(h.state, h.node), LlmAuthError);
    assert.equal(fallback.requests.length, 0);
  });
});
