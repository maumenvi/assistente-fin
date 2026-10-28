import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { reactNode } from '../../../src/app/agent/graph/nodes/react.node.ts';
import { type ToolPort } from '../../../src/app/agent/ports/tool/tool.port.ts';
import { ReplayLlm } from '../../../src/libs/llm/replay/replay.llm.ts';
import { makeNodeHarness, TOOLS_CAPABILITIES } from './support/node.harness.ts';

const tools: ToolPort = {
  list: () => [{ name: 'query_transactions', description: 'consulta', inputSchema: { type: 'object' } }],
  execute: () => Promise.reject(new Error('nao usado')),
};

describe('continueOnLength (US4, T036–T037)', () => {
  it('concatena múltiplas continuações sem teto fixo quando finish === "length" até finish === "stop"', async () => {
    const main = new ReplayLlm(TOOLS_CAPABILITIES, [
      {
        events: [
          { type: 'text_delta', text: 'Parte 1: R$ 10,00; ' },
          { type: 'usage', inputTokens: 10, outputTokens: 10, costMicroUsd: 100 },
          { type: 'finish', reason: 'length' },
        ],
      },
      {
        events: [
          { type: 'text_delta', text: 'Parte 2: R$ 20,00; ' },
          { type: 'usage', inputTokens: 15, outputTokens: 10, costMicroUsd: 100 },
          { type: 'finish', reason: 'length' },
        ],
      },
      {
        events: [
          { type: 'text_delta', text: 'Parte 3: R$ 30,00; ' },
          { type: 'usage', inputTokens: 20, outputTokens: 10, costMicroUsd: 100 },
          { type: 'finish', reason: 'length' },
        ],
      },
      {
        events: [
          { type: 'text_delta', text: 'Parte 4 final.' },
          { type: 'usage', inputTokens: 25, outputTokens: 5, costMicroUsd: 50 },
          { type: 'finish', reason: 'stop' },
        ],
      },
    ]);

    const h = await makeNodeHarness({ main, tools });
    const result = await reactNode.run(h.state, h.node);

    assert.equal(result.next, 'respond');
    assert.equal(
      result.state.finalText,
      'Parte 1: R$ 10,00; Parte 2: R$ 20,00; Parte 3: R$ 30,00; Parte 4 final.',
    );
    assert.equal(main.requests.length, 4);
    assert.match(
      JSON.stringify(main.requests[1]?.messages.at(-1)),
      /continue exatamente de onde parou/i,
    );
    assert.equal(result.detail?.inputTokens, 70);
    assert.equal(result.detail?.outputTokens, 35);
    assert.equal(result.detail?.costMicroUsd, 350);
    assert.equal(result.state.notices.length, 0);
  });

  it('para quando o orçamento da execução é atingido e anexa aviso declarando o corte e perguntando se quer estender o limite', async () => {
    const main = new ReplayLlm(TOOLS_CAPABILITIES, [
      {
        events: [
          { type: 'text_delta', text: 'Item 1; ' },
          { type: 'usage', inputTokens: 10, outputTokens: 10, costMicroUsd: 60_000 },
          { type: 'finish', reason: 'length' },
        ],
      },
      {
        events: [
          { type: 'text_delta', text: 'Item 2; ' },
          { type: 'usage', inputTokens: 15, outputTokens: 10, costMicroUsd: 50_000 },
          { type: 'finish', reason: 'length' },
        ],
      },
      {
        events: [
          { type: 'text_delta', text: 'Nao deveria chegar aqui' },
          { type: 'finish', reason: 'stop' },
        ],
      },
    ]);

    const h = await makeNodeHarness({ main, tools });
    const result = await reactNode.run(h.state, {
      ...h.node,
      budget: { maxSteps: 12, maxMs: 60_000, maxCostMicroUsd: 100_000 },
    });

    assert.equal(main.requests.length, 2);
    assert.equal(result.state.finalText, 'Item 1; Item 2; ');
    const notice = result.state.notices.find((n) => n.kind === 'truncated' || n.kind === 'budget_reached');
    assert.ok(notice, 'deve emitir aviso quando o orçamento interrompe a continuação');
    assert.match(notice.text, /estender o limite/i);
  });

  it('para imediatamente se uma continuação não acrescentar texto novo', async () => {
    const main = new ReplayLlm(TOOLS_CAPABILITIES, [
      {
        events: [
          { type: 'text_delta', text: 'Texto inicial.' },
          { type: 'finish', reason: 'length' },
        ],
      },
      {
        events: [
          { type: 'text_delta', text: '   ' },
          { type: 'finish', reason: 'length' },
        ],
      },
    ]);

    const h = await makeNodeHarness({ main, tools });
    const result = await reactNode.run(h.state, h.node);
    assert.equal(main.requests.length, 2);
    assert.equal(result.state.finalText, 'Texto inicial.');
  });
});
