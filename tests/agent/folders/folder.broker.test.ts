import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { FolderAccessDeniedError } from '../../../src/domain/agent/errors/folder.access.denied.error.ts';
import { PathOutsideGrantError } from '../../../src/domain/agent/errors/path.outside.grant.error.ts';
import { UnknownFileRequestError } from '../../../src/app/agent/folders/folder.broker.ts';
import { createFilesWorld } from './files.world.ts';

const requested = (w: ReturnType<typeof createFilesWorld>) => w.events.filter((e) => e.type === 'folder_permission_requested');

describe('FolderBroker', () => {
  it('sem concessao pergunta; "uma vez" vale so para a execucao e expira no fim dela', async () => {
    const w = createFilesWorld();
    w.disk.addFile('/home/ana/Docs/a.txt', 'oi');
    const ctx = w.scope({ decide: 'once' });
    assert.equal(await ctx.files?.ensure('/home/ana/Docs/a.txt', 'read'), '/home/ana/Docs/a.txt');
    assert.equal(requested(w).length, 1);
    const request = requested(w)[0];
    assert.ok(request?.type === 'folder_permission_requested' && request.path === '/home/ana/Docs' && request.access === 'read');
    await ctx.files?.ensure('/home/ana/Docs/outro.txt', 'read');
    assert.equal(requested(w).length, 1, 'segunda operacao na mesma execucao nao pergunta de novo');
    w.broker.releaseRun('r1');
    await w.scope({ runId: 'r2', decide: 'deny' }).files?.ensure('/home/ana/Docs/a.txt', 'read').catch(() => undefined);
    assert.equal(requested(w).length, 2, 'em outra execucao pergunta de novo');
    assert.deepEqual(await w.broker.list('u1'), []);
  });

  it('"esta pasta" fica no cofre, vale para outras execucoes e some ao revogar', async () => {
    const w = createFilesWorld();
    await w.scope({ decide: 'folder' }).files?.ensure('/home/ana/Docs/a.txt', 'read');
    const [grant] = await w.broker.list('u1');
    assert.ok(grant !== undefined && grant.scope === 'persistent' && grant.path === '/home/ana/Docs');
    await w.scope({ runId: 'r2' }).files?.ensure('/home/ana/Docs/sub/b.txt', 'read');
    assert.equal(requested(w).length, 1);
    assert.equal(await w.broker.revoke('u1', grant.id), true);
    await assert.rejects(w.scope({ runId: 'r3', decide: 'deny' }).files?.ensure('/home/ana/Docs/a.txt', 'read') ?? Promise.resolve(), FolderAccessDeniedError);
    assert.equal(requested(w).length, 2, 'depois de revogar o agente pergunta de novo');
  });

  it('negar lanca FolderAccessDeniedError e emite file_request_resolved denied', async () => {
    const w = createFilesWorld();
    await assert.rejects(w.scope({ decide: 'deny' }).files?.ensure('/home/ana/Docs/a.txt', 'read') ?? Promise.resolve(), FolderAccessDeniedError);
    const resolved = w.events.find((e) => e.type === 'file_request_resolved');
    assert.ok(resolved?.type === 'file_request_resolved' && resolved.outcome === 'denied');
  });

  it('concessao de leitura nao cobre criar nem editar', async () => {
    const w = createFilesWorld();
    await w.scope({ decide: 'folder' }).files?.ensure('/home/ana/Docs/a.txt', 'read');
    await assert.rejects(w.scope({ runId: 'r2', decide: 'deny' }).files?.ensure('/home/ana/Docs/a.txt', 'edit') ?? Promise.resolve(), FolderAccessDeniedError);
    const last = requested(w).at(-1);
    assert.ok(last?.type === 'folder_permission_requested' && last.access === 'edit');
  });

  it('caminho proibido nunca pergunta; `..` e caminho relativo sao recusados', async () => {
    const w = createFilesWorld();
    const ctx = w.scope({ decide: 'folder' });
    await assert.rejects(ctx.files?.ensure('/home/ana/.ssh/id_rsa', 'read') ?? Promise.resolve(), FolderAccessDeniedError);
    await assert.rejects(ctx.files?.ensure('/home/ana/proj/.env', 'read') ?? Promise.resolve(), FolderAccessDeniedError);
    await assert.rejects(ctx.files?.ensure('/home/ana/Docs/../.ssh/id', 'read') ?? Promise.resolve(), PathOutsideGrantError);
    await assert.rejects(ctx.files?.ensure('Docs/a.txt', 'read') ?? Promise.resolve(), PathOutsideGrantError);
    assert.equal(requested(w).length, 0);
  });

  it('link simbolico para fora da pasta: o pedido mostra o destino real', async () => {
    const w = createFilesWorld();
    w.disk.links.set('/home/ana/Docs/atalho', '/etc/segredos');
    w.disk.dirs.add('/etc/segredos');
    await w.scope({ decide: 'folder' }).files?.ensure('/home/ana/Docs/x.txt', 'read');
    await assert.rejects(w.scope({ runId: 'r2', decide: 'deny' }).files?.ensure('/home/ana/Docs/atalho', 'read') ?? Promise.resolve(), FolderAccessDeniedError);
    const last = requested(w).at(-1);
    assert.ok(last?.type === 'folder_permission_requested' && last.path === '/etc/segredos');
  });

  it('dois pedidos de conversas diferentes sao independentes', async () => {
    const w = createFilesWorld();
    const a = w.scope({ conversationId: 'cA', runId: 'rA' });
    const b = w.scope({ conversationId: 'cB', runId: 'rB' });
    const pa = a.files?.ensure('/home/ana/A/x.txt', 'read');
    const pb = b.files?.ensure('/home/ana/B/y.txt', 'read');
    await new Promise((resolve) => setImmediate(resolve));
    const [reqA, reqB] = requested(w);
    assert.ok(reqA?.type === 'folder_permission_requested' && reqB?.type === 'folder_permission_requested' && reqA.requestId !== reqB.requestId);
    assert.deepEqual(w.broker.pendingOf('u1', 'cA').length, 1);
    w.broker.decide('u1', reqB.requestId, 'once');
    assert.equal(await pb, '/home/ana/B/y.txt');
    assert.equal(w.broker.pendingOf('u1', 'cA').length, 1, 'A continua esperando');
    w.broker.decide('u1', reqA.requestId, 'deny');
    await assert.rejects(pa ?? Promise.resolve(), FolderAccessDeniedError);
  });

  it('decidir um pedido inexistente ou de outro usuario falha', async () => {
    const w = createFilesWorld();
    const pending = w.scope().files?.ensure('/home/ana/A/x.txt', 'read');
    await new Promise((resolve) => setImmediate(resolve));
    const req = requested(w)[0];
    assert.ok(req?.type === 'folder_permission_requested');
    assert.throws(() => w.broker.decide('outra-pessoa', req.requestId, 'folder'), UnknownFileRequestError);
    assert.throws(() => w.broker.decide('u1', 'nao-existe', 'folder'), UnknownFileRequestError);
    w.broker.decide('u1', req.requestId, 'deny');
    await assert.rejects(pending ?? Promise.resolve(), FolderAccessDeniedError);
    assert.throws(() => w.broker.decide('u1', req.requestId, 'folder'), UnknownFileRequestError, 'ja decidido');
  });

  it('parar a execucao nega o pedido e conta o tempo de espera fora do orcamento', async () => {
    const w = createFilesWorld();
    const controller = new AbortController();
    const waited = { ms: 0 };
    const pending = w.scope({ signal: controller.signal, waited }).files?.ensure('/home/ana/A/x.txt', 'read');
    await new Promise((resolve) => setImmediate(resolve));
    controller.abort();
    await assert.rejects(pending ?? Promise.resolve(), FolderAccessDeniedError);
    assert.equal(w.broker.pendingOf('u1', 'c1').length, 0);
    assert.equal(waited.ms, 0, 'relogio fixo: espera de 0 ms, mas o acumulador foi usado sem erro');
  });

  it('outra pasta escolhida que nao cobre o pedido avisa o agente (redirected)', async () => {
    const w = createFilesWorld();
    const ctx = w.scope();
    const pending = ctx.files?.ensure('/home/ana/A/x.txt', 'read');
    await new Promise((resolve) => setImmediate(resolve));
    const req = requested(w)[0];
    assert.ok(req?.type === 'folder_permission_requested');
    w.broker.decide('u1', req.requestId, 'once', '/home/ana/B');
    await assert.rejects(pending ?? Promise.resolve(), (error: unknown) => error instanceof FolderAccessDeniedError && error.reason === 'redirected' && error.redirectTo === '/home/ana/B');
    // a pasta escolhida ficou liberada para esta execucao: refazer o pedido nela nao pergunta de novo
    await w.scope().files?.ensure('/home/ana/B/y.txt', 'read');
    assert.equal(requested(w).length, 1);
  });

  it('pasta que nao existe para o app (ex.: Flatpak isolado) vem marcada como ausente no pedido', async () => {
    const w = createFilesWorld();
    w.disk.dirs.add('/home/ana/Docs');
    await w.scope({ decide: 'deny' }).files?.ensure('/mnt/ssd-backup/Extratos', 'read').catch(() => undefined);
    await w.scope({ runId: 'r2', decide: 'deny' }).files?.ensure('/home/ana/Docs', 'read').catch(() => undefined);
    const [missing, present] = requested(w);
    assert.ok(missing?.type === 'folder_permission_requested' && missing.missing === true);
    assert.ok(present?.type === 'folder_permission_requested' && present.missing === false);
  });

  it('adicionar pasta direto (botao do chat): vale em definitivo, sem pergunta; so leitura nao cobre criar; pasta proibida e recusada', async () => {
    const w = createFilesWorld();
    w.disk.dirs.add('/home/ana/Extratos');
    const read = await w.broker.addGrant('u1', '/home/ana/Extratos', 'read');
    assert.deepEqual(read.access, ['read']);
    await w.scope().files?.ensure('/home/ana/Extratos/a.csv', 'read');
    assert.equal(requested(w).length, 0, 'ja liberada: nao pergunta');
    await w.scope({ runId: 'r2', decide: 'deny' }).files?.ensure('/home/ana/Extratos/rel.html', 'create').catch(() => undefined);
    assert.equal(requested(w).length, 1, 'so leitura: criar pergunta');
    const write = await w.broker.addGrant('u1', '/home/ana/Extratos', 'write');
    assert.deepEqual(write.access, ['read', 'create', 'edit']);
    assert.equal((await w.broker.list('u1')).length, 1, 'mesma pasta substitui a concessao anterior');
    await w.scope({ runId: 'r3' }).files?.ensure('/home/ana/Extratos/rel.html', 'create');
    assert.equal(requested(w).length, 1);
    w.disk.dirs.add('/home/ana/.ssh');
    await assert.rejects(w.broker.addGrant('u1', '/home/ana/.ssh', 'read'), FolderAccessDeniedError);
    await assert.rejects(w.broker.addGrant('u1', '/home/ana/nao-existe', 'read'), FolderAccessDeniedError);
    await assert.rejects(w.broker.addGrant('u1', '/home/ana/Extratos/../.ssh', 'read'), PathOutsideGrantError);
  });

  it('cartao "escolha uma pasta": a pessoa escolhe, a pasta fica liberada com o acesso pedido; agora nao = negado', async () => {
    const w = createFilesWorld();
    w.disk.dirs.add('/home/ana/Extratos');
    const pending = w.scope().files?.requestFolder('read');
    await new Promise((resolve) => setImmediate(resolve));
    const req = requested(w)[0];
    assert.ok(req?.type === 'folder_permission_requested' && req.path === '' && req.access === 'read');
    w.broker.decide('u1', req.requestId, 'folder', '/home/ana/Extratos');
    assert.equal(await pending, '/home/ana/Extratos');
    assert.deepEqual((await w.broker.list('u1')).map((g) => [g.path, g.access]), [['/home/ana/Extratos', ['read']]]);
    const no = w.scope({ runId: 'r2' }).files?.requestFolder('edit');
    await new Promise((resolve) => setImmediate(resolve));
    const second = requested(w)[1];
    assert.ok(second?.type === 'folder_permission_requested');
    w.broker.decide('u1', second.requestId, 'deny');
    await assert.rejects(no ?? Promise.resolve(), FolderAccessDeniedError);
  });

  it('"Adicionar arquivo": libera so aquele arquivo; o vizinho continua sem acesso; o cartao grava com a pasta escolhida', async () => {
    const w = createFilesWorld();
    w.disk.addFile('/home/ana/Docs/fatura.pdf', 'x');
    w.disk.addFile('/home/ana/Docs/outro.pdf', 'y');
    await w.broker.addGrant('u1', '/home/ana/Docs/fatura.pdf', 'read');
    await w.scope().files?.ensure('/home/ana/Docs/fatura.pdf', 'read');
    assert.equal(requested(w).length, 0);
    await w.scope({ runId: 'r2', decide: 'deny' }).files?.ensure('/home/ana/Docs/outro.pdf', 'read').catch(() => undefined);
    assert.equal(requested(w).length, 1, 'o outro arquivo nao foi liberado');
    // escolha no cartao: vale em definitivo, leitura e gravacao quando o assistente precisa criar
    const pending = w.scope({ runId: 'r3' }).files?.ensure('/home/ana/Docs/rel.html', 'create');
    await new Promise((resolve) => setImmediate(resolve));
    const req = requested(w).at(-1);
    assert.ok(req?.type === 'folder_permission_requested');
    w.broker.decide('u1', req.requestId, 'folder', '/home/ana/Docs');
    assert.equal(await pending, '/home/ana/Docs/rel.html');
    const grant = (await w.broker.list('u1')).find((g) => g.path === '/home/ana/Docs');
    assert.deepEqual(grant?.access, ['read', 'create', 'edit']);
  });
});
