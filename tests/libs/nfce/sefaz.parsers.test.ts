import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseSefazPage } from '../../../src/libs/nfce/sefaz/sefaz.parser.registry.ts';

const page = (name: string) => readFileSync(new URL(`../../fixtures/nfce/sefaz/${name}`, import.meta.url), 'utf8');

test('layout do Portal da NFC-e: total, data e razao social (SP, MG, RJ, PR, RS, SC, BA, GO, DF)', () => {
  for (const uf of ['SP', 'MG', 'RJ', 'PR', 'RS', 'SC', 'BA', 'GO', 'DF']) {
    assert.deepEqual(parseSefazPage(uf, page('portal.layout.html')), {
      amountCents: 21248,
      date: '2026-09-24',
      merchant: 'MERCADO CENTRAL LTDA',
    });
  }
});

test('pagina fora do layout ou UF sem parser -> undefined (vira "conferir")', () => {
  assert.equal(parseSefazPage('SP', page('unknown.layout.html')), undefined);
  assert.equal(parseSefazPage('AC', page('portal.layout.html')), undefined);
});
