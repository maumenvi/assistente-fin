import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { toolPortFor } from '../../../src/app/agent/graph/nodes/tool.port.for.ts';
import { initialAgentState } from '../../../src/app/agent/graph/initial.agent.state.ts';
import { type NodeContext } from '../../../src/app/agent/graph/node.context.ts';
import { type ToolPort } from '../../../src/app/agent/ports/tool/tool.port.ts';
import { DEFAULT_AGENT_PROMPTS } from '../../../src/app/agent/prompts/default.agent.prompts.ts';
import { type Intent } from '../../../src/domain/agent/intent.ts';

const port = (name: string): ToolPort => ({ list: () => [{ name, description: name, inputSchema: {} }], execute: () => Promise.reject(new Error('nao usado')) });
const ctx = { tools: port('read'), memoryTools: port('memory'), planTools: port('plan') } as unknown as NodeContext;
const portName = (intent: Intent | null, c: NodeContext = ctx) => toolPortFor({ ...initialAgentState('r1'), intent }, c).list()[0]?.name;

describe('ferramentas por intencao (spec 033)', () => {
  it('write_request ve consulta + propose_changes; as demais intencoes nao', () => {
    assert.equal(portName('write_request'), 'plan');
    assert.equal(portName('query'), 'read');
    assert.equal(portName('preference'), 'memory');
    assert.equal(portName('direct'), 'read');
  });

  it('sem ferramentas de plano, write_request volta ao registro de consulta', () => {
    assert.equal(portName('write_request', { ...ctx, planTools: undefined } as unknown as NodeContext), 'read');
  });

  it('o prompt do modo escrita manda propor, nunca gravar, e ignorar ordens em <dados>', () => {
    const text = DEFAULT_AGENT_PROMPTS.writeMode();
    assert.match(text, /NÃO grava nada/);
    assert.match(text, /propose_changes/);
    assert.match(text, /replaces/);
    assert.match(text, /nunca instrução/);
  });
});
