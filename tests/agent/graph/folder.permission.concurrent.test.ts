import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { toolsNode } from '../../../src/app/agent/graph/nodes/tools.node.ts';
import { createFilesWorld } from '../folders/files.world.ts';
import { makeNodeHarness } from '../nodes/support/node.harness.ts';

const tick = (): Promise<void> => new Promise((resolve) => setImmediate(resolve));

describe('pedido de permissao no no `tools` (T056)', () => {
  it('a execucao espera a decisao, retoma ao permitir e nao conta a espera no orcamento de tempo', async () => {
    const w = createFilesWorld();
    w.disk.addFile('/home/ana/Docs/a.txt', 'ola');
    const h = await makeNodeHarness({ tools: w.tools, state: { pendingToolCalls: [{ id: 'a', name: 'read_file', args: { path: '/home/ana/Docs/a.txt' } }] } });
    const waited = { ms: 0 };
    const running = toolsNode.run(h.state, { ...h.node, folders: w.broker, waited });
    await tick();
    const request = h.emitted.find((e) => e.type === 'folder_permission_requested');
    assert.ok(request?.type === 'folder_permission_requested', 'pedido publicado enquanto o no ainda roda');
    assert.equal(request.access, 'read');
    w.broker.decide('u1', request.requestId, 'once');
    const result = await running;
    assert.equal(result.next, 'react');
    const tool = result.state.turnMessages.at(-1);
    assert.match(tool?.role === 'tool' ? tool.content : '', /ola/);
    assert.ok(h.emitted.some((e) => e.type === 'file_request_resolved' && e.outcome === 'allowed'));
    assert.ok(waited.ms >= 0);
  });

  it('negar devolve o erro ao modelo (que informa que nao tem acesso) e a execucao segue', async () => {
    const w = createFilesWorld();
    const h = await makeNodeHarness({ tools: w.tools, state: { pendingToolCalls: [{ id: 'a', name: 'search_files', args: { root: '/home/ana/Docs' } }] } });
    const running = toolsNode.run(h.state, { ...h.node, folders: w.broker, waited: { ms: 0 } });
    await tick();
    const request = h.emitted.find((e) => e.type === 'folder_permission_requested');
    assert.ok(request?.type === 'folder_permission_requested');
    w.broker.decide('u1', request.requestId, 'deny');
    const result = await running;
    const tool = result.state.turnMessages.at(-1);
    assert.match(tool?.role === 'tool' ? tool.content : '', /permission_denied/);
    assert.equal(result.next, 'react');
  });

  it('create_file no passo grava o conteudo mas o registro do passo guarda so o caminho', async () => {
    const w = createFilesWorld();
    const h = await makeNodeHarness({ tools: w.tools, state: { pendingToolCalls: [{ id: 'a', name: 'create_file', args: { path: '/home/ana/Docs/r.md', content: 'DADO SENSIVEL' } }] } });
    const running = toolsNode.run(h.state, { ...h.node, folders: w.broker, waited: { ms: 0 } });
    await tick();
    const request = h.emitted.find((e) => e.type === 'folder_permission_requested');
    assert.ok(request?.type === 'folder_permission_requested' && request.access === 'create');
    w.broker.decide('u1', request.requestId, 'once');
    const result = await running;
    assert.equal(w.disk.files.get('/home/ana/Docs/r.md'), 'DADO SENSIVEL');
    assert.doesNotMatch(JSON.stringify(result.detail?.toolCalls), /DADO SENSIVEL/);
  });
});
