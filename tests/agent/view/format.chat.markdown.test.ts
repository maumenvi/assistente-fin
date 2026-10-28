import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { formatChatText } from '../../../src/app/agent/view/format.chat.text.ts';

describe('Markdown do chat', () => {
  it('titulo, lista, numerada, italico e codigo', () => {
    const blocks = formatChatText('## Resumo\n- um **dois**\n1. primeiro\n2. segundo\ntexto *leve* e `x=1`');
    assert.deepEqual(blocks.map((b) => b.kind), ['heading', 'item', 'item', 'item', 'paragraph']);
    assert.equal(blocks[0]?.kind === 'heading' && blocks[0].level, 2);
    assert.equal(blocks[2]?.kind === 'item' && blocks[2].marker, '1.');
    const p = blocks[4];
    assert.deepEqual(p?.kind === 'paragraph' ? p.runs.map((r) => [r.text, r.italic === true, r.code === true]) : [], [['texto ', false, false], ['leve', true, false], [' e ', false, false], ['x=1', false, true]]);
  });
  it('tabela em varias linhas', () => {
    const [t] = formatChatText('| Cartão | Gasto |\n|---|---|\n| Iti | R$ 3.399,42 |\n| Nubank | R$ 2.389,26 |');
    assert.equal(t?.kind, 'table');
    if (t?.kind !== 'table') return;
    assert.deepEqual([t.header.map((c) => c[0]?.text), t.rows.length, t.rows[1]?.[1]?.[0]?.text], [['Cartão', 'Gasto'], 2, 'R$ 2.389,26']);
  });
  it('tabela colada numa linha so (como o modelo escreveu) tambem vira tabela', () => {
    const blocks = formatChatText('Cartões\n\n| Cartão | Gasto (fatura) | |--------|----------------| | Iti | R$ 3.399,42 | | Nubank | R$ 2.389,26 |\n\n*Observação*');
    const table = blocks.find((b) => b.kind === 'table');
    assert.ok(table && table.kind === 'table');
    assert.deepEqual([table.header.length, table.rows.length], [2, 2]);
    assert.equal(blocks.at(-1)?.kind, 'paragraph');
  });
  it('html nao e interpretado e marcas sem par ficam como texto', () => {
    const [p] = formatChatText('<b>x</b> 2 * 3 e **aberto');
    assert.equal(p?.kind === 'paragraph' && p.runs.map((r) => r.text).join(''), '<b>x</b> 2 * 3 e **aberto');
  });
});
