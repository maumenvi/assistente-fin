import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickSharedText, MAX_SHARED_TEXT_CHARS } from '../../../../src/app/ai-exchange/share/pick.shared.text.ts';

const BLOCK = 'FINCTRL-IMPORT v1\n{"batchId":"lote-0001","ops":[]}';

test('texto compartilhado direto vira o texto a importar (spec 029, FR-016)', async () => {
  assert.equal(await pickSharedText([{ value: BLOCK, shareType: 'text', mimeType: 'text/plain' }], async () => ''), BLOCK);
});

test('arquivo de texto, JSON ou Markdown e lido; outros tipos sao ignorados', async () => {
  const files: Record<string, string> = { 'file:///a.json': BLOCK, 'file:///b.md': 'texto', 'file:///c.png': 'binario' };
  const read = async (uri: string) => files[uri] ?? '';
  assert.equal(await pickSharedText([{ value: 'file:///a.json', shareType: 'file', mimeType: 'application/json' }], read), BLOCK);
  assert.equal(await pickSharedText([{ value: 'file:///b.md', shareType: 'file', mimeType: 'text/markdown' }], read), 'texto');
  assert.equal(await pickSharedText([{ value: 'file:///c.png', shareType: 'image', mimeType: 'image/png' }], read), null);
});

test('com varios itens prefere o que tem a marca do formato', async () => {
  const picked = await pickSharedText(
    [
      { value: 'Aqui esta a resposta', shareType: 'text' },
      { value: BLOCK, shareType: 'text' },
    ],
    async () => '',
  );
  assert.equal(picked, BLOCK);
});

test('sem marca, devolve o primeiro texto util para a importacao explicar o motivo', async () => {
  assert.equal(await pickSharedText([{ value: '   ', shareType: 'text' }, { value: 'oi', shareType: 'text' }], async () => ''), 'oi');
  assert.equal(await pickSharedText([], async () => ''), null);
});

test('arquivo ilegivel nao derruba os demais; texto enorme e descartado', async () => {
  const read = async (uri: string): Promise<string> => {
    if (uri === 'file:///ruim.txt') throw new Error('sem permissao');
    return 'x'.repeat(MAX_SHARED_TEXT_CHARS + 1);
  };
  const picked = await pickSharedText(
    [
      { value: 'file:///ruim.txt', shareType: 'file', mimeType: 'text/plain' },
      { value: 'file:///grande.txt', shareType: 'file', mimeType: 'text/plain' },
      { value: BLOCK, shareType: 'text' },
    ],
    read,
  );
  assert.equal(picked, BLOCK);
});
