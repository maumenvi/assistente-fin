import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { attachmentFacts } from '../../../src/app/agent/attachment/model/attachment.facts.ts';
import { MAX_VALUE_FACTS_PER_ATTACHMENT } from '../../../src/app/agent/attachment/model/cell.value.facts.ts';
import { FactLedger } from '../../../src/app/agent/verify/fact.ledger.ts';
import { maskFigures } from '../../../src/app/agent/verify/mask.figures.ts';
import { verifyFigures } from '../../../src/app/agent/verify/verify.figures.ts';
import { type ExtractedContent } from '../../../src/domain/agent/attachment/extracted.content.ts';

function statement(rows: string[][]): { id: string; name: string; extracted: ExtractedContent } {
  return {
    id: 'a1',
    name: 'extrato.csv',
    extracted: {
      kind: 'csv',
      text: null,
      sheets: [{ name: 'extrato', header: ['Data', 'Descrição', 'Valor'], rows, rowCount: rows.length, totalRows: rows.length, numericTotals: { 2: 0 } }],
      warnings: [],
      stats: { rows: rows.length, chars: 0 },
    },
  };
}

describe('valores do anexo no livro-razao (spec 040, R5/FR-006)', () => {
  const rows = Array.from({ length: 60 }, (_, i) => [`${String((i % 28) + 1).padStart(2, '0')}/09/2026`, `Compra ${i}`, `${(i + 1) * 10},${String(i % 100).padStart(2, '0')}`]);
  const ledger = new FactLedger(attachmentFacts([statement(rows)]));

  it('citar valor e data de qualquer linha NAO e mascarado', () => {
    const text = 'Em 15/09/2026 houve R$ 160,15 e tambem R$ 600,59 em 28/09/2026.';
    const v = verifyFigures(text, ledger);
    assert.deepEqual(v.mismatches.map((m) => m.raw), []);
  });

  it('valor inventado continua mascarado', () => {
    const text = 'Voce pagou R$ 999.999,99 em 15/09/2026.';
    const v = verifyFigures(text, ledger);
    assert.equal(v.ok, false);
    assert.equal(maskFigures(text, v.mismatches), 'Voce pagou (valor não confirmado) em 15/09/2026.');
  });

  it('data ISO e valor com ponto decimal tambem entram', () => {
    const l = new FactLedger(attachmentFacts([statement([['2026-10-03', 'Salario', '1234.56']])]));
    assert.equal(verifyFigures('Em 03/10/2026 entrou R$ 1.234,56.', l).ok, true);
  });

  it('campo ilegivel nao derruba os demais', () => {
    const l = new FactLedger(attachmentFacts([statement([['??', 'Compra', 'ilegivel'], ['05/09/2026', 'Mercado', '42,10']])]));
    assert.equal(verifyFigures('Mercado: R$ 42,10 em 05/09/2026.', l).ok, true);
  });

  it('5.000 linhas: respeita o teto de fatos e confere rapido', () => {
    const big = Array.from({ length: 5000 }, (_, i) => ['01/09/2026', `x${i}`, `${i},${String(i % 100).padStart(2, '0')}`]);
    const facts = attachmentFacts([statement(big)]);
    const valueOnly = facts.filter((f) => f.id.includes(':v:'));
    assert.ok(valueOnly.length <= MAX_VALUE_FACTS_PER_ATTACHMENT);
    const started = performance.now();
    const l = new FactLedger(facts);
    for (let i = 0; i < 1000; i += 1) l.has('money', String(i));
    assert.ok(performance.now() - started < 500);
  });

  it('texto de txt/pdf: valores de cada linha sao fatos', () => {
    const content: ExtractedContent = { kind: 'text', text: '10/09/2026 Padaria 33,40\n11/09/2026 Posto 180,00', sheets: [], warnings: [], stats: { rows: 2, chars: 50 } };
    const l = new FactLedger(attachmentFacts([{ id: 't1', name: 'x.txt', extracted: content }]));
    assert.equal(verifyFigures('Padaria R$ 33,40 e posto R$ 180,00 (11/09/2026).', l).ok, true);
  });
});
