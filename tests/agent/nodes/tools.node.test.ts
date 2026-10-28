import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { z } from 'zod';
import { toolsNode, MAX_TOOL_CALLS_PER_RUN } from '../../../src/app/agent/graph/nodes/tools.node.ts';
import { eraseAgentTool } from '../../../src/app/agent/tools/agent.tool.ts';
import { RegistryToolPort } from '../../../src/app/agent/tools/registry.tool.port.ts';
import { buildToolResult } from '../../../src/app/agent/tools/shared/build.tool.result.ts';
import { moneyFact } from '../../../src/app/agent/tools/shared/money.fact.ts';
import { createToolRegistry } from '../../../src/app/agent/tools/tool.registry.ts';
import { makeNodeHarness } from './support/node.harness.ts';

const summary = (tool: string) => ({ tool, label: `consulta ${tool}`, filters: {}, itemCount: 2, truncated: false });

const registry = createToolRegistry([
  eraseAgentTool({
    id: 'ok_tool', description: 'ok', effect: 'read', input: z.object({ n: z.number().optional() }),
    run: (args) => Promise.resolve(buildToolResult({ tool: 'ok_tool', body: `n=${String(args.n)}`, facts: [moneyFact(`f${String(args.n)}`, 'valor', 1234)], summary: summary('ok_tool') })),
  }),
  eraseAgentTool({ id: 'boom_tool', description: 'falha', effect: 'read', input: z.object({}), run: () => Promise.reject(new Error('quebrou')) }),
]);
const port = new RegistryToolPort(registry);

describe('tools node', () => {
  it('executa em paralelo, alimenta ledger, resumos, mensagens tool e cartoes', async () => {
    const h = await makeNodeHarness({ tools: port, state: { pendingToolCalls: [{ id: 'a', name: 'ok_tool', args: { n: 1 } }, { id: 'b', name: 'ok_tool', args: { n: 2 } }] } });
    const result = await toolsNode.run(h.state, h.node);
    assert.equal(result.next, 'react');
    assert.equal(result.state.pendingToolCalls.length, 0);
    assert.deepEqual(result.state.ledger.filter((f) => !f.id.endsWith(':count')).map((f) => [f.id, f.sourceCallId]), [['f1', 'a'], ['f2', 'b']]);
    // a quantidade de itens achados tambem vira fato citavel (spec 040)
    assert.deepEqual(result.state.ledger.filter((f) => f.id.endsWith(':count')).map((f) => [f.kind, f.value]), [['count', 2], ['count', 2]]);
    assert.equal(result.state.summaries.length, 2);
    assert.deepEqual(result.state.turnMessages.slice(-2).map((m) => (m.role === 'tool' ? m.toolCallId : null)), ['a', 'b']);
    assert.equal(h.emitted.filter((e) => e.type === 'query_card').length, 2);
    assert.equal(result.detail?.toolCalls?.length, 2);
    assert.equal(result.state.counters.toolCalls, 2);
  });

  it('falha de uma chamada nao cancela as outras; o erro volta ao modelo', async () => {
    const h = await makeNodeHarness({ tools: port, state: { pendingToolCalls: [{ id: 'a', name: 'boom_tool', args: {} }, { id: 'b', name: 'ok_tool', args: { n: 3 } }, { id: 'c', name: 'nao_existe', args: {} }] } });
    const result = await toolsNode.run(h.state, h.node);
    assert.equal(result.state.ledger.filter((f) => !f.id.endsWith(':count')).length, 1);
    assert.equal(result.state.summaries.length, 1);
    const contents = result.state.turnMessages.filter((m) => m.role === 'tool').map((m) => (m.role === 'tool' ? m.content : ''));
    assert.match(contents[0] ?? '', /erro \(failed\)/);
    assert.match(contents[2] ?? '', /erro \(not_found\)/);
    assert.equal(h.emitted.filter((e) => e.type === 'query_card').length, 1);
  });

  it('argumentos ilegiveis voltam como erro sem executar e contam como reparo', async () => {
    const h = await makeNodeHarness({ tools: port, state: { pendingToolCalls: [{ id: 'a', name: 'ok_tool', args: null, argsError: 'JSON invalido' }] } });
    const result = await toolsNode.run(h.state, h.node);
    assert.equal(result.state.counters.argRepairAttempts, 1);
    assert.equal(result.state.ledger.length, 0);
    const content = result.state.turnMessages.at(-1);
    assert.match(content?.role === 'tool' ? content.content : '', /argumentos ilegiveis: JSON invalido/);
  });

  it('respeita o orcamento de chamadas por execucao', async () => {
    const calls = Array.from({ length: 3 }, (_, i) => ({ id: `x${i}`, name: 'ok_tool', args: { n: i } }));
    const h = await makeNodeHarness({ tools: port, state: { pendingToolCalls: calls, counters: { llmCalls: 1, toolCalls: MAX_TOOL_CALLS_PER_RUN - 1, correctionAttempts: 0, argRepairAttempts: 0 } } });
    const result = await toolsNode.run(h.state, h.node);
    assert.equal(result.state.ledger.filter((f) => !f.id.endsWith(':count')).length, 1);
    assert.match(result.state.turnMessages.at(-1)?.role === 'tool' ? (result.state.turnMessages.at(-1) as { content: string }).content : '', /limite de consultas/);
  });
});

describe('fatos derivados da chamada (spec 040)', () => {
  it('as datas pedidas e a quantidade achada entram no ledger: periodo e contagem citados nao sao mascarados', async () => {
    const dated = createToolRegistry([
      eraseAgentTool({ id: 'q', description: 'q', effect: 'read', input: z.object({ from: z.string(), to: z.string() }), run: () => Promise.resolve(buildToolResult({ tool: 'q', body: 'ok', facts: [], summary: { tool: 'q', label: 'lancamentos', filters: {}, itemCount: 31, truncated: false } })) }),
    ]);
    const h = await makeNodeHarness({ tools: new RegistryToolPort(dated), state: { pendingToolCalls: [{ id: 'a', name: 'q', args: { from: '2026-01-01', to: '2026-10-31' } }] } });
    const result = await toolsNode.run(h.state, h.node);
    const keys = result.state.ledger.map((f) => `${f.kind}:${String(f.value)}`);
    assert.ok(keys.includes('count:31'));
    assert.ok(keys.includes('date:2026-01-01') && keys.includes('date:2026-10-31'));
  });
});
