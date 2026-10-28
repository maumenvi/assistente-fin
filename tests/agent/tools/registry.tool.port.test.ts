import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { z } from 'zod';
import { eraseAgentTool } from '../../../src/app/agent/tools/agent.tool.ts';
import { RegistryToolPort } from '../../../src/app/agent/tools/registry.tool.port.ts';
import { buildToolResult } from '../../../src/app/agent/tools/shared/build.tool.result.ts';
import { createToolRegistry } from '../../../src/app/agent/tools/tool.registry.ts';
import { type ToolContext } from '../../../src/app/agent/ports/tool/tool.context.ts';

const ctx: ToolContext = { userId: 'u1', now: new Date('2026-10-22T12:00:00Z'), locale: 'pt-BR', limits: { maxItems: 10, maxChars: 6000, timeoutMs: 50 } };
const summary = { tool: 'echo', label: 'eco', filters: {}, itemCount: 1, truncated: false };

function port(run: (args: { text: string }, ctx: ToolContext) => Promise<ReturnType<typeof buildToolResult>>): RegistryToolPort {
  return new RegistryToolPort(
    createToolRegistry([eraseAgentTool({ id: 'echo', description: 'Repete o texto', effect: 'read', input: z.object({ text: z.string().min(1) }), run })]),
  );
}

describe('RegistryToolPort', () => {
  it('valida os argumentos e executa com o contexto da sessao', async () => {
    let seenUser = '';
    const result = await port((args, c) => {
      seenUser = c.userId;
      return Promise.resolve(buildToolResult({ tool: 'echo', body: args.text, facts: [], summary }));
    }).execute({ id: 'c1', name: 'echo', args: { text: 'oi' } }, ctx);
    assert.equal(result.ok, true);
    assert.match(result.contentForModel, /oi/);
    assert.equal(seenUser, 'u1');
  });

  it('argumentos invalidos: resultado de erro curto em pt-BR para o modelo corrigir', async () => {
    const result = await port(() => Promise.reject(new Error('nao devia chamar'))).execute({ id: 'c1', name: 'echo', args: { text: '' } }, ctx);
    assert.equal(result.ok, false);
    assert.equal(result.error?.code, 'invalid_args');
    assert.match(result.error?.message ?? '', /argumentos invalidos \(text/);
    assert.ok((result.error?.message.length ?? 0) <= 240);
  });

  it('args ausentes (null) validam como objeto vazio', async () => {
    const result = await port(() => Promise.reject(new Error('x'))).execute({ id: 'c1', name: 'echo', args: null }, ctx);
    assert.equal(result.error?.code, 'invalid_args');
  });

  it('ferramenta inexistente', async () => {
    const result = await port(() => Promise.reject(new Error('x'))).execute({ id: 'c1', name: 'nao_existe', args: {} }, ctx);
    assert.equal(result.error?.code, 'not_found');
  });

  it('estourou o tempo limite', async () => {
    const result = await port(() => new Promise(() => undefined)).execute({ id: 'c1', name: 'echo', args: { text: 'a' } }, ctx);
    assert.equal(result.error?.code, 'timeout');
  });

  it('excecao da ferramenta vira failed, sem vazar a mensagem interna', async () => {
    const result = await port(() => Promise.reject(new Error('senha do banco: 1234'))).execute({ id: 'c1', name: 'echo', args: { text: 'a' } }, ctx);
    assert.equal(result.error?.code, 'failed');
    assert.equal(JSON.stringify(result).includes('senha do banco'), false);
  });

  it('chamadas em paralelo: a falha de uma nao afeta a outra', async () => {
    const p = port((args) => (args.text === 'ruim' ? Promise.reject(new Error('x')) : Promise.resolve(buildToolResult({ tool: 'echo', body: args.text, facts: [], summary }))));
    const results = await Promise.all([
      p.execute({ id: 'a', name: 'echo', args: { text: 'bom' } }, ctx),
      p.execute({ id: 'b', name: 'echo', args: { text: 'ruim' } }, ctx),
    ]);
    assert.deepEqual(results.map((r) => r.ok), [true, false]);
  });

  it('list devolve as specs do registro', () => {
    assert.deepEqual(port(() => Promise.reject(new Error('x'))).list().map((s) => s.name), ['echo']);
  });
});
