import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createToolRegistry } from '../../../../src/app/agent/tools/tool.registry.ts';
import { buildDefaultAgentTools } from '../../../../src/app/agent/tools/default.agent.tools.ts';
import { buildFileTools } from '../../../../src/app/agent/tools/files/file.tool.registry.ts';
import { createFilesWorld } from '../../folders/files.world.ts';

const call = (name: string, args: unknown) => ({ id: `call-${name}`, name, args });

describe('ferramentas de arquivo', () => {
  it('search_files lista dentro da pasta autorizada e embrulha o resultado como dado', async () => {
    const w = createFilesWorld();
    w.disk.addFile('/home/ana/Docs/extrato-set.csv', 'x');
    w.disk.addFile('/home/ana/Docs/nota.txt', 'y');
    const result = await w.tools.execute(call('search_files', { root: '/home/ana/Docs', query: 'extrato' }), w.scope({ decide: 'once' }));
    assert.equal(result.ok, true);
    assert.match(result.contentForModel, /^<dados origem="arquivo:search_files">/);
    assert.match(result.contentForModel, /extrato-set\.csv/);
    assert.doesNotMatch(result.contentForModel, /nota\.txt/);
    assert.equal(result.facts[0]?.value, 1);
  });

  it('read_file de csv vira fatos de TODOS os valores legiveis (nada de "valor nao confirmado")', async () => {
    const w = createFilesWorld();
    w.disk.addFile('/home/ana/Docs/extrato.csv', 'data;descricao;valor\n05/09/2026;Mercado;1.234,56\n06/09/2026;Padaria;-42,10\n');
    const result = await w.tools.execute(call('read_file', { path: '/home/ana/Docs/extrato.csv' }), w.scope({ decide: 'folder' }));
    assert.equal(result.ok, true);
    assert.match(result.contentForModel, /Mercado/);
    const cents = result.facts.filter((f) => f.kind === 'money').map((f) => f.value);
    assert.ok(cents.includes(123456), 'R$ 1.234,56');
    assert.ok(cents.includes(4210) || cents.includes(-4210), 'R$ 42,10');
  });

  it('read_file de texto longo pagina com offset; arquivo grande demais e recusado', async () => {
    const w = createFilesWorld();
    w.disk.addFile('/home/ana/Docs/longo.txt', 'a'.repeat(25_000));
    const ctx = w.scope({ decide: 'folder' });
    const first = await w.tools.execute(call('read_file', { path: '/home/ana/Docs/longo.txt' }), ctx);
    assert.match(first.contentForModel, /Há mais: use offset=10000/);
    const last = await w.tools.execute(call('read_file', { path: '/home/ana/Docs/longo.txt', offset: 20_000 }), ctx);
    assert.match(last.contentForModel, /Fim do arquivo/);
    w.disk.addFile('/home/ana/Docs/enorme.txt', 'b'.repeat(2 * 1024 * 1024 + 1));
    const big = await w.tools.execute(call('read_file', { path: '/home/ana/Docs/enorme.txt' }), ctx);
    assert.equal(big.error?.code, 'too_large');
  });

  it('create_file nunca sobrescreve: o nome existente ganha sufixo', async () => {
    const w = createFilesWorld();
    const ctx = w.scope({ decide: 'folder' });
    const one = await w.tools.execute(call('create_file', { path: '/home/ana/Docs/rel.md', content: 'um' }), ctx);
    const two = await w.tools.execute(call('create_file', { path: '/home/ana/Docs/rel.md', content: 'dois' }), ctx);
    assert.match(one.contentForModel, /rel\.md/);
    assert.match(two.contentForModel, /rel-2\.md/);
    assert.equal(w.disk.files.get('/home/ana/Docs/rel.md'), 'um');
  });

  it('edit_file com git grava direto, sem pedir confirmacao', async () => {
    const w = createFilesWorld();
    w.git.inside = true;
    w.disk.addFile('/home/ana/proj/notas.md', 'ola mundo');
    const result = await w.tools.execute(call('edit_file', { path: '/home/ana/proj/notas.md', edits: [{ find: 'mundo', replace: 'Ana' }] }), w.scope({ decide: 'folder' }));
    assert.equal(result.ok, true);
    assert.equal(w.disk.files.get('/home/ana/proj/notas.md'), 'ola Ana');
    assert.equal(w.events.filter((e) => e.type === 'file_edit_confirmation_requested').length, 0);
  });

  it('edit_file sem git mostra a previa: aprovar grava, negar deixa o arquivo intacto', async () => {
    const approved = createFilesWorld();
    approved.disk.addFile('/home/ana/proj/notas.md', 'ola mundo');
    const ok = await approved.tools.execute(call('edit_file', { path: '/home/ana/proj/notas.md', edits: [{ find: 'mundo', replace: 'Ana' }] }), approved.scope({ decide: 'folder', approveEdit: true }));
    assert.equal(ok.ok, true);
    assert.equal(approved.disk.files.get('/home/ana/proj/notas.md'), 'ola Ana');
    const preview = approved.events.find((e) => e.type === 'file_edit_confirmation_requested');
    assert.ok(preview?.type === 'file_edit_confirmation_requested' && preview.preview.before.includes('mundo') && preview.preview.after.includes('Ana'));

    const denied = createFilesWorld();
    denied.disk.addFile('/home/ana/proj/notas.md', 'ola mundo');
    const no = await denied.tools.execute(call('edit_file', { path: '/home/ana/proj/notas.md', edits: [{ find: 'mundo', replace: 'Ana' }] }), denied.scope({ decide: 'folder', approveEdit: false }));
    assert.equal(no.ok, false);
    assert.equal(no.error?.code, 'permission_denied');
    assert.equal(denied.disk.files.get('/home/ana/proj/notas.md'), 'ola mundo');
  });

  it('edit_file recusa trecho ausente ou ambiguo e args com content E edits', async () => {
    const w = createFilesWorld();
    w.git.inside = true;
    w.disk.addFile('/home/ana/proj/a.txt', 'x x');
    const ctx = w.scope({ decide: 'folder' });
    assert.equal((await w.tools.execute(call('edit_file', { path: '/home/ana/proj/a.txt', edits: [{ find: 'x', replace: 'y' }] }), ctx)).error?.code, 'invalid_args');
    assert.equal((await w.tools.execute(call('edit_file', { path: '/home/ana/proj/a.txt', edits: [{ find: 'z', replace: 'y' }] }), ctx)).error?.code, 'invalid_args');
    assert.equal((await w.tools.execute(call('edit_file', { path: '/home/ana/proj/a.txt', content: 'a', edits: [{ find: 'x', replace: 'y' }] }), ctx)).error?.code, 'invalid_args');
    assert.equal(w.disk.files.get('/home/ana/proj/a.txt'), 'x x');
  });

  it('arquivo inexistente vira not_found, sem expor erro de sistema', async () => {
    const w = createFilesWorld();
    const result = await w.tools.execute(call('read_file', { path: '/home/ana/Docs/nao-existe.txt' }), w.scope({ decide: 'folder' }));
    assert.equal(result.error?.code, 'not_found');
  });

  it('sem a porta de permissao a ferramenta falha fechada', async () => {
    const w = createFilesWorld();
    const result = await w.tools.execute(call('read_file', { path: '/home/ana/Docs/a.txt' }), (({ files: _gate, ...rest }) => rest)(w.scope()));
    assert.equal(result.ok, false);
    assert.equal(w.disk.reads, 0);
  });

  it('o efeito file so existe no registro proprio: consulta, memoria e planejamento o recusam', () => {
    const w = createFilesWorld();
    const tools = buildFileTools({ files: w.disk, git: w.git });
    for (const allow of [['read'], ['read', 'write'], ['memory'], ['read', 'external'], ['read', 'write', 'external']] as const) {
      assert.throws(() => createToolRegistry(tools, allow), /nao e permitido/);
    }
    assert.equal(createToolRegistry(tools, ["read", "file"]).list().length, 6);
    // as ferramentas de consulta continuam sem nenhuma de arquivo
    assert.equal(buildDefaultAgentTools({} as never).some((t) => t.effect === 'file'), false);
  });
});
