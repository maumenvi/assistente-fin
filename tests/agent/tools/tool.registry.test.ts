import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { z } from 'zod';
import { eraseAgentTool, type AgentTool } from '../../../src/app/agent/tools/agent.tool.ts';
import { buildToolResult } from '../../../src/app/agent/tools/shared/build.tool.result.ts';
import { createToolRegistry } from '../../../src/app/agent/tools/tool.registry.ts';

function tool<A>(overrides: Partial<AgentTool<A>> & Pick<AgentTool<A>, 'input'>): ReturnType<typeof eraseAgentTool> {
  return eraseAgentTool<A>({
    id: 'get_thing',
    description: 'Busca uma coisa',
    effect: 'read',
    run: () => Promise.resolve(buildToolResult({ tool: 'get_thing', body: 'x', facts: [], summary: { tool: 'get_thing', label: 'x', filters: {}, itemCount: 0, truncated: false } })),
    ...overrides,
  });
}

describe('createToolRegistry', () => {
  it('gera o JSON Schema sem $schema e lista as ferramentas', () => {
    const registry = createToolRegistry([tool({ input: z.object({ month: z.string(), limit: z.number().optional() }) })]);
    const [spec] = registry.list();
    assert.equal(spec?.name, 'get_thing');
    assert.equal(spec?.description, 'Busca uma coisa');
    assert.equal('$schema' in (spec?.inputSchema ?? {}), false);
    assert.equal(spec?.inputSchema['type'], 'object');
    assert.deepEqual(spec?.inputSchema['required'], ['month']);
    assert.ok(registry.get('get_thing'));
    assert.equal(registry.get('nao_existe'), undefined);
  });

  it('o JSON Schema e gerado uma vez (mesma referencia a cada list)', () => {
    const registry = createToolRegistry([tool({ input: z.object({}) })]);
    assert.equal(registry.list()[0], registry.list()[0]);
  });

  it('recusa ferramenta de escrita enquanto a spec 033 nao habilitar', () => {
    assert.throws(() => createToolRegistry([tool({ input: z.object({}), effect: 'write' })]), /nao e permitido neste registro/);
    assert.throws(() => createToolRegistry([tool({ input: z.object({}), effect: 'memory' })]), /nao e permitido neste registro/);
    assert.doesNotThrow(() => createToolRegistry([tool({ input: z.object({}), effect: 'memory' })], ['memory']));
  });

  it('recusa id duplicado, id fora de snake_case e descricao vazia', () => {
    assert.throws(() => createToolRegistry([tool({ input: z.object({}) }), tool({ input: z.object({}) })]), /duplicada/);
    assert.throws(() => createToolRegistry([tool({ input: z.object({}), id: 'GetThing' })]), /snake_case/);
    assert.throws(() => createToolRegistry([tool({ input: z.object({}), description: '  ' })]), /descricao obrigatoria/);
  });

  it('recusa schema com userId (o usuario vem da sessao)', () => {
    assert.throws(() => createToolRegistry([tool({ input: z.object({ userId: z.string() }) })]), /userId/);
  });
});
