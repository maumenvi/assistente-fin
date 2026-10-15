import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseReceiptText } from '../../../src/domain/capture/parse.receipt.text.ts';

/** Parser de comprovante (spec 022, T123/T125): textos de OCR em `tests/fixtures/receipts`. */
const dir = join(dirname(fileURLToPath(import.meta.url)), '../../fixtures/receipts');
const read = (name: string) => readFileSync(join(dir, name), 'utf8');

const CASES = [
  ['maquininha.credito.txt', { origin: 'receipt', amountCents: 4590, date: '2026-09-25', description: 'Padaria Pao Quente', paymentMethod: 'credit-card', installments: 1, accountHint: 'final 4412', confidence: 'high' }],
  ['maquininha.debito.txt', { origin: 'receipt', amountCents: 123456, date: '2026-09-03', description: 'Mercadinho Bom Preco', paymentMethod: 'debit-card', accountHint: 'final 1234', confidence: 'high' }],
  ['maquininha.parcelado.txt', { origin: 'receipt', amountCents: 89970, date: '2026-08-12', description: 'Eletro Casa Comercio', paymentMethod: 'credit-card', installments: 3, accountHint: 'final 9876', confidence: 'high' }],
  ['pix.banco.txt', { origin: 'receipt', amountCents: 15000, date: '2026-09-25', description: 'Maria da Silva Souza', paymentMethod: 'pix', confidence: 'high' }],
  ['recibo.txt', { origin: 'receipt', amountCents: 30000, date: '2026-09-20', description: 'aulas de violão de setembro', paymentMethod: 'cash', confidence: 'high' }],
  ['ilegivel.txt', { origin: 'receipt', confidence: 'low' }],
] as const;

for (const [file, expected] of CASES) {
  test(`comprovante ${file}`, () => {
    assert.deepEqual(parseReceiptText(read(file)), expected);
  });
}

test('OCR com O no lugar de 0 no valor', () => {
  assert.equal(parseReceiptText('TOTAL R$ 1O,5O\n01/09/2026').amountCents, 1050);
});
