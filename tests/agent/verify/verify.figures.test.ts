import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { type Fact } from '../../../src/domain/agent/fact.ts';
import { FactLedger } from '../../../src/app/agent/verify/fact.ledger.ts';
import { maskFigures, UNCONFIRMED_FIGURE_TEXT } from '../../../src/app/agent/verify/mask.figures.ts';
import { verifyFigures } from '../../../src/app/agent/verify/verify.figures.ts';

const fact = (kind: Fact['kind'], value: number | string, display: string): Fact => ({
  id: `${kind}-${String(value)}`, kind, value, display, label: 'teste', sourceCallId: 'c1',
});

const ledgerOf = (...facts: Fact[]): FactLedger => new FactLedger(facts);

describe('verifyFigures', () => {
  it('valor presente passa', () => {
    const result = verifyFigures('Voce gastou R$ 1.284,60 com Mercado.', ledgerOf(fact('money', 128460, 'R$ 1.284,60')));
    assert.equal(result.ok, true);
    assert.deepEqual(result.mismatches, []);
  });

  it('valor trocado falha e aponta a figura', () => {
    const result = verifyFigures('Voce gastou R$ 1.284,70.', ledgerOf(fact('money', 128460, 'R$ 1.284,60')));
    assert.equal(result.ok, false);
    assert.deepEqual(result.mismatches.map((m) => m.raw), ['R$ 1.284,70']);
  });

  it('o mesmo valor escrito de outro jeito passa', () => {
    const ledger = ledgerOf(fact('money', 128460, 'R$ 1.284,60'));
    for (const text of ['R$1284,60', 'R$ 1.284,6', '1.284,60 reais']) {
      assert.equal(verifyFigures(text, ledger).ok, true, text);
    }
  });

  it('quantidade, percentual e data sao conferidos contra fatos do mesmo tipo', () => {
    const ledger = ledgerOf(fact('count', 38, '38'), fact('percent', 28, '28%'), fact('date', '2026-09-30', '30/09/2026'));
    assert.equal(verifyFigures('38 lançamentos, 28% do limite, em 30/09/2026 e 30/09', ledger).ok, true);
    const wrong = verifyFigures('39 lançamentos, 29% do limite, em 01/10/2026', ledger);
    assert.deepEqual(wrong.mismatches.map((m) => m.kind), ['count', 'percent', 'date']);
  });

  it('um valor nao vale por outro tipo (centavos 38 nao confirmam "38 lançamentos")', () => {
    const ledger = ledgerOf(fact('money', 38, 'R$ 0,38'));
    assert.equal(verifyFigures('38 lançamentos', ledger).ok, false);
  });

  it('figura escrita pelo usuario na pergunta e permitida na resposta', () => {
    const ledger = new FactLedger();
    ledger.addUserText('Posso gastar R$ 300,00 em 30/09?');
    assert.equal(verifyFigures('Sim, R$ 300,00 em 30/09 cabem.', ledger).ok, true);
    assert.equal(verifyFigures('Sim, R$ 301,00 cabem.', ledger).ok, false);
  });

  it('texto sem figuras passa ("nao encontrei dados")', () => {
    assert.equal(verifyFigures('Nao encontrei lançamentos nesse periodo.', new FactLedger()).ok, true);
  });

  it('o snapshot e serializavel e reconstroi o mesmo ledger', () => {
    const ledger = ledgerOf(fact('money', 51540, 'R$ 515,40'));
    ledger.addUserText('R$ 10');
    const rebuilt = new FactLedger(JSON.parse(JSON.stringify(ledger.snapshot())) as Fact[]);
    assert.equal(verifyFigures('R$ 515,40 e R$ 10,00', rebuilt).ok, true);
  });

  it('numero calculado pelo modelo sem vir de consulta ou calculate e sinalizado e mascarado (spec 037, FR-010, T024)', () => {
    const ledger = ledgerOf(fact('money', 100_000, 'R$ 1.000,00'), fact('money', 40_000, 'R$ 400,00'));
    const text = 'Você gastou R$ 1.000,00 em agosto e R$ 400,00 em setembro, uma diferença de R$ 600,00 (60%).';
    const check = verifyFigures(text, ledger);
    assert.equal(check.ok, false);
    assert.deepEqual(check.mismatches.map((m) => m.raw), ['R$ 600,00', '60%']);
    assert.equal(
      maskFigures(text, check.mismatches),
      `Você gastou R$ 1.000,00 em agosto e R$ 400,00 em setembro, uma diferença de ${UNCONFIRMED_FIGURE_TEXT} (${UNCONFIRMED_FIGURE_TEXT}).`,
    );
  });
});

describe('maskFigures', () => {
  it('troca so a figura nao confirmada e preserva o resto', () => {
    const text = 'Gastou R$ 1.284,70 em Mercado, restam R$ 515,40.';
    const result = verifyFigures(text, ledgerOf(fact('money', 51540, 'R$ 515,40')));
    assert.equal(maskFigures(text, result.mismatches), `Gastou ${UNCONFIRMED_FIGURE_TEXT} em Mercado, restam R$ 515,40.`);
  });

  it('varias figuras, da direita para a esquerda, sem desalinhar', () => {
    const text = 'A R$ 1,00 e B R$ 2,00 e C 99%';
    const result = verifyFigures(text, new FactLedger());
    assert.equal(
      maskFigures(text, result.mismatches),
      `A ${UNCONFIRMED_FIGURE_TEXT} e B ${UNCONFIRMED_FIGURE_TEXT} e C ${UNCONFIRMED_FIGURE_TEXT}`,
    );
  });

  it('sem divergencia devolve o texto intacto', () => {
    assert.equal(maskFigures('nada a mascarar', []), 'nada a mascarar');
  });
});
