import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { reactNode } from '../../../src/app/agent/graph/nodes/react.node.ts';
import { RunCancelledError } from '../../../src/domain/agent/errors/run.cancelled.error.ts';
import { LlmUnavailableError } from '../../../src/domain/agent/errors/llm.unavailable.error.ts';
import { ReplayLlm } from '../../../src/libs/llm/replay/replay.llm.ts';
import { type ToolPort } from '../../../src/app/agent/ports/tool/tool.port.ts';
import { CONSERVATIVE_CAPABILITIES } from '../../../src/domain/agent/conservative.capabilities.ts';
import { makeNodeHarness, TOOLS_CAPABILITIES } from './support/node.harness.ts';

const tools: ToolPort = {
  list: () => [{ name: 'query_transactions', description: 'consulta', inputSchema: { type: 'object' } }],
  execute: () => Promise.reject(new Error('nao usado')),
};

const textTurn = (text: string) => ({ events: [{ type: 'text_delta' as const, text }, { type: 'usage' as const, inputTokens: 10, outputTokens: 5, cachedTokens: 2, costMicroUsd: 300 }, { type: 'finish' as const, reason: 'stop' as const }] });

describe('react node', () => {
  it('texto puro: publica os deltas, soma o uso e segue para respond', async () => {
    const main = new ReplayLlm(TOOLS_CAPABILITIES, [{ events: [{ type: 'text_delta', text: 'Você gastou ' }, { type: 'text_delta', text: 'R$ 10,00.' }, { type: 'usage', inputTokens: 10, outputTokens: 5, costMicroUsd: 300 }, { type: 'finish', reason: 'stop' }] }]);
    const h = await makeNodeHarness({ main, tools });
    const result = await reactNode.run(h.state, h.node);
    assert.equal(result.next, 'respond');
    assert.equal(result.state.finalText, 'Você gastou R$ 10,00.');
    assert.deepEqual(h.emitted.filter((e) => e.type === 'text_delta').map((e) => (e as { text: string }).text), ['Você gastou ', 'R$ 10,00.']);
    assert.equal(result.detail?.inputTokens, 10);
    assert.equal(result.detail?.costMicroUsd, 300);
    assert.equal(result.state.counters.llmCalls, 1);
    assert.equal(result.state.turnMessages.at(-1)?.role, 'assistant');
    assert.deepEqual(main.requests[0]?.tools?.map((t) => t.name), ['query_transactions']);
    assert.equal(main.requests[0]?.toolChoice, 'auto');
    assert.equal(main.requests[0]?.messages.at(-1)?.role, 'user');
  });

  it('chamada de ferramenta: guarda pendingToolCalls e vai para tools', async () => {
    const main = new ReplayLlm(TOOLS_CAPABILITIES, [
      { events: [{ type: 'tool_call', id: 'c1', name: 'query_transactions', args: { from: '2026-09-01', to: '2026-09-30' } }, { type: 'provider_state', state: { r: 1 } }, { type: 'finish', reason: 'tool_calls' }] },
    ]);
    const h = await makeNodeHarness({ main, tools });
    const result = await reactNode.run(h.state, h.node);
    assert.equal(result.next, 'tools');
    assert.equal(result.state.pendingToolCalls.length, 1);
    assert.equal(result.state.pendingToolCalls[0]?.name, 'query_transactions');
    const last = result.state.turnMessages.at(-1);
    assert.equal(last?.role === 'assistant' && last.toolCalls?.[0]?.id, 'c1');
    assert.deepEqual(last?.role === 'assistant' && last.providerState, { r: 1 });
    assert.equal(result.state.finalText, null);
  });

  it('falha retriavel antes de conteudo: usa o perfil alternativo e marca fallbackUsed', async () => {
    const main = new ReplayLlm(TOOLS_CAPABILITIES, [{ events: [], error: { code: 'LLM_UNAVAILABLE' } }]);
    const fallback = new ReplayLlm(TOOLS_CAPABILITIES, [textTurn('Resposta do alternativo.')]);
    const h = await makeNodeHarness({ main, fallback, tools });
    const result = await reactNode.run(h.state, h.node);
    assert.equal(result.detail?.fallbackUsed, true);
    assert.equal(result.state.finalText, 'Resposta do alternativo.');
    assert.equal(h.log.warns.length, 1);
  });

  it('sem perfil alternativo, o erro de dominio propaga', async () => {
    const main = new ReplayLlm(TOOLS_CAPABILITIES, [{ events: [], error: { code: 'LLM_UNAVAILABLE' } }]);
    const h = await makeNodeHarness({ main, tools });
    await assert.rejects(reactNode.run(h.state, h.node), LlmUnavailableError);
  });

  it('erro nao retriavel (chave invalida) nao usa o alternativo', async () => {
    const main = new ReplayLlm(TOOLS_CAPABILITIES, [{ events: [], error: { code: 'LLM_AUTH' } }]);
    const fallback = new ReplayLlm(TOOLS_CAPABILITIES, [textTurn('nao deveria')]);
    const h = await makeNodeHarness({ main, fallback, tools });
    await assert.rejects(reactNode.run(h.state, h.node));
    assert.equal(fallback.requests.length, 0);
  });

  it('falha depois de conteudo: nao troca de modelo e guarda o texto parcial', async () => {
    const main = new ReplayLlm(TOOLS_CAPABILITIES, [{ events: [{ type: 'text_delta', text: 'Você gastou' }], error: { code: 'LLM_UNAVAILABLE' } }]);
    const fallback = new ReplayLlm(TOOLS_CAPABILITIES, [textTurn('nao deveria')]);
    const h = await makeNodeHarness({ main, fallback, tools });
    await assert.rejects(reactNode.run(h.state, h.node), LlmUnavailableError);
    assert.equal(fallback.requests.length, 0);
    const message = (await h.store.messages.list('u1', 'c1', { limit: 5 })).find((m) => m.id === 'r1-a');
    assert.deepEqual(message?.parts, [{ type: 'text', text: 'Você gastou' }]);
  });

  it('sem tools no modelo: nao envia ferramentas e avisa so na primeira volta', async () => {
    const main = new ReplayLlm({ ...CONSERVATIVE_CAPABILITIES, contextWindow: 32_000 }, [textTurn('Posso explicar o conceito.')]);
    const h = await makeNodeHarness({ main, tools });
    const first = await reactNode.run(h.state, h.node);
    assert.equal(main.requests[0]?.tools, undefined);
    assert.deepEqual(first.state.notices.map((n) => n.kind), ['no_tools']);
    assert.equal(h.emitted.filter((e) => e.type === 'notice').length, 1);
    assert.match(main.requests[0]?.system ?? '', /não consegue consultar os dados/);
    const again = await reactNode.run({ ...first.state }, h.node);
    assert.equal(again.state.notices.length, 1);
    assert.equal(h.emitted.filter((e) => e.type === 'notice').length, 1);
  });

  it('muitas falhas de argumento: passa a responder sem ferramentas (toolChoice none)', async () => {
    const main = new ReplayLlm(TOOLS_CAPABILITIES, [textTurn('Não consegui consultar.')]);
    const h = await makeNodeHarness({ main, tools, state: { counters: { llmCalls: 3, toolCalls: 2, correctionAttempts: 0, argRepairAttempts: 2 } } });
    await reactNode.run(h.state, h.node);
    assert.equal(main.requests[0]?.toolChoice, 'none');
  });

  it('cancelamento no meio: propaga RunCancelledError e guarda o parcial', async () => {
    const h = await makeNodeHarness({ tools });
    const main = new ReplayLlm(TOOLS_CAPABILITIES, [{ events: [{ type: 'text_delta', text: 'Parcial' }, { type: 'text_delta', text: ' fim' }, { type: 'finish', reason: 'stop' }], delayMs: 5 }]);
    const ctx = { ...h.node, llm: () => ({ llm: main, answeredBy: 'main' as const }) };
    setTimeout(() => h.controller.abort(), 7);
    await assert.rejects(reactNode.run(h.state, ctx), RunCancelledError);
    const saved = (await h.store.messages.list('u1', 'c1', { limit: 5 })).find((m) => m.id === 'r1-a');
    assert.deepEqual(saved?.parts, [{ type: 'text', text: 'Parcial' }]);
  });

  it('os deltas saem antes de qualquer gravacao (store lento nao atrasa o stream)', async () => {
    const main = new ReplayLlm(TOOLS_CAPABILITIES, [textTurn('Olá')]);
    const h = await makeNodeHarness({ main, tools });
    const order: string[] = [];
    const store = h.node.store;
    const original = store.messages.update.bind(store.messages);
    store.messages.update = async (...args) => {
      order.push('update');
      await new Promise((r) => setTimeout(r, 30));
      return original(...args);
    };
    const ctx = { ...h.node, emit: (body: Parameters<typeof h.node.emit>[0]) => { order.push(body.type); h.node.emit(body); } };
    await reactNode.run(h.state, ctx);
    assert.equal(order[0], 'text_delta');
  });

  it('T035 (FR-014): modelo sem suporte a ferramentas preserva comportamento atual mesmo com as ferramentas novas registradas', async () => {
    const allTools: ToolPort = {
      list: () => [
        { name: 'query_transactions', description: 'consulta', inputSchema: { type: 'object' } },
        { name: 'list_uncategorized_transactions', description: 'pendentes', inputSchema: { type: 'object' } },
        { name: 'calculate', description: 'calculo', inputSchema: { type: 'object' } },
        { name: 'compare_periods', description: 'comparacao', inputSchema: { type: 'object' } },
      ],
      execute: () => Promise.reject(new Error('nao deveria chamar ferramenta')),
    };
    const main = new ReplayLlm({ ...CONSERVATIVE_CAPABILITIES, tools: false, contextWindow: 32_000 }, [
      textTurn('Não consigo consultar seus dados nem calcular sobre eles sem suporte a ferramentas.'),
    ]);
    const h = await makeNodeHarness({ main, tools: allTools });
    const res = await reactNode.run(h.state, h.node);
    assert.equal(res.next, 'respond');
    assert.equal(main.requests[0]?.tools, undefined);
    assert.equal(main.requests[0]?.toolChoice, undefined);
    assert.deepEqual(res.state.notices.map((n) => n.kind), ['no_tools']);
    assert.match(res.state.finalText ?? '', /Não consigo consultar/);
  });
});
