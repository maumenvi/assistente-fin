import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { extractFigures } from '../../../src/app/agent/verify/extract.figures.ts';

const kinds = (text: string) => extractFigures(text).map((f) => `${f.kind}:${f.normalized}`);

describe('extractFigures', () => {
  it('valores em reais, em todos os formatos', () => {
    assert.deepEqual(kinds('gastou R$ 1.284,60 e R$1284,60'), ['money:128460', 'money:128460']);
    assert.deepEqual(kinds('sobraram 515,40 reais'), ['money:51540']);
    assert.deepEqual(kinds('foram 1.800 reais no mes'), ['money:180000']);
    assert.deepEqual(kinds('R$ 10 e R$ 0,50'), ['money:1000', 'money:50']);
    assert.deepEqual(kinds('saldo de -R$ 10,00'), ['money:-1000']);
  });

  it('o ponto final da frase nao entra no valor', () => {
    const [figure] = extractFigures('Restam R$ 515,40.');
    assert.equal(figure?.raw, 'R$ 515,40');
    assert.equal(figure?.normalized, '51540');
  });

  it('percentuais', () => {
    assert.deepEqual(kinds('usou 28% e 28,5 % do limite'), ['percent:28', 'percent:28.5']);
    assert.deepEqual(kinds('100,0%'), ['percent:100']);
  });

  it('datas completas e curtas', () => {
    assert.deepEqual(kinds('vence em 05/10/2026 ou 5/1/2026'), ['date:2026-10-05', 'date:2026-01-05']);
    assert.deepEqual(kinds('pago em 30/09 e 05/10'), ['date:09-30', 'date:10-05']);
  });

  it('quantidades com substantivo', () => {
    assert.deepEqual(kinds('em 38 lançamentos, 3 parcelas e 2 cartões'), ['count:38', 'count:3', 'count:2']);
    assert.deepEqual(kinds('1.200 itens e 12 contas'), ['count:1200', 'count:12']);
  });

  it('posicoes apontam para o trecho exato', () => {
    const text = 'Total: R$ 1.284,60 em 38 lançamentos';
    for (const figure of extractFigures(text)) assert.equal(text.slice(figure.start, figure.end), figure.raw);
  });

  it('NAO extrai: R$ sozinho, mes/ano, versoes, fracoes, numeros soltos, datas por extenso', () => {
    assert.deepEqual(kinds('o simbolo R$ aparece sozinho'), []);
    assert.deepEqual(kinds('em 10/2026 e em 9/2026'), []);
    assert.deepEqual(kinds('versao 1.0.18 do app'), []);
    assert.deepEqual(kinds('3/4 dos gastos'), []);
    assert.deepEqual(kinds('12 meses e 5 dias'), []);
    assert.deepEqual(kinds('dia 2 de outubro'), []);
    assert.deepEqual(kinds('data impossivel 31/02/abc e 45/13'), []);
  });

  it('o valor tem prioridade sobre a quantidade que o contem', () => {
    assert.deepEqual(kinds('R$ 100 contas'), ['money:10000']);
  });

  it('sem sobreposicao e em ordem de aparicao', () => {
    const figures = extractFigures('28% de R$ 1.800,00 ate 30/09/2026 em 5 lançamentos');
    assert.deepEqual(figures.map((f) => f.kind), ['percent', 'money', 'date', 'count']);
    for (let i = 1; i < figures.length; i += 1) assert.ok((figures[i] as { start: number }).start >= (figures[i - 1] as { end: number }).end);
  });
});
