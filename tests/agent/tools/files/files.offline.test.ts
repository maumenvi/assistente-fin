import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { createFilesWorld } from '../../folders/files.world.ts';

const call = (name: string, args: unknown) => ({ id: `call-${name}`, name, args });

describe('arquivos sem o provedor de IA (FR-021)', () => {
  const realFetch = globalThis.fetch;
  beforeEach(() => {
    globalThis.fetch = () => Promise.reject(new TypeError('fetch failed: provedor offline'));
  });
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  it('listar, ler, criar, editar e decidir permissao funcionam localmente; so o modelo falha', async () => {
    const w = createFilesWorld();
    w.git.inside = true;
    w.disk.addFile('/home/ana/Docs/a.txt', 'ola');
    const ctx = w.scope({ decide: 'folder' });
    assert.equal((await w.tools.execute(call('search_files', { root: '/home/ana/Docs' }), ctx)).ok, true);
    assert.equal((await w.tools.execute(call('read_file', { path: '/home/ana/Docs/a.txt' }), ctx)).ok, true);
    assert.equal((await w.tools.execute(call('create_file', { path: '/home/ana/Docs/b.txt', content: 'novo' }), ctx)).ok, true);
    assert.equal((await w.tools.execute(call('edit_file', { path: '/home/ana/Docs/a.txt', content: 'oi' }), ctx)).ok, true);
    assert.equal(w.disk.files.get('/home/ana/Docs/a.txt'), 'oi');
    // o pedido ao modelo e que falha, com erro claro
    await assert.rejects(fetch('https://provedor.example/v1/chat'), /offline/);
  });
});
