import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseSpokenPurchase } from '../../../src/domain/capture/parse.spoken.purchase.ts';

interface Expected {
  readonly phrase: string;
  readonly amountCents: number;
  readonly paymentMethod: string;
  readonly accountHint: string | null;
  readonly installments: number | null;
}

const phrases = JSON.parse(
  readFileSync(new URL('../../fixtures/voice/phrases.json', import.meta.url), 'utf8'),
) as Expected[];

test('as duas frases da spec (US6, cenarios 1 e 2)', () => {
  const first = parseSpokenPurchase('Fiz compra no supermercado, gastei 145.30 reais, credito parcelado 2x no iti');
  assert.equal(first.amountCents, 14530);
  assert.equal(first.paymentMethod, 'credit-card');
  assert.equal(first.installments, 2);
  assert.equal(first.accountHint, 'iti');
  assert.equal(first.description, 'supermercado');
  const second = parseSpokenPurchase('Comprei queijo, ficou em 65 reais no pix no itau');
  assert.equal(second.amountCents, 6500);
  assert.equal(second.paymentMethod, 'pix');
  assert.equal(second.accountHint, 'itau');
  assert.equal(second.description, 'queijo');
});

test('SC-007: >= 90% das 50 frases com valor, forma e conta/cartao corretos', () => {
  assert.equal(phrases.length, 50);
  const wrong: string[] = [];
  for (const expected of phrases) {
    const draft = parseSpokenPurchase(expected.phrase);
    const ok =
      draft.amountCents === expected.amountCents &&
      draft.paymentMethod === expected.paymentMethod &&
      (draft.accountHint ?? null) === expected.accountHint &&
      (expected.installments === null || draft.installments === expected.installments);
    if (!ok) wrong.push(`${expected.phrase} -> ${JSON.stringify({ ...draft, notes: undefined })}`);
  }
  const rate = (phrases.length - wrong.length) / phrases.length;
  assert.ok(rate >= 0.9, `acerto ${Math.round(rate * 100)}%:\n${wrong.join('\n')}`);
});

test('frase sem valor reconhecivel: valor em branco e confianca baixa', () => {
  const draft = parseSpokenPurchase('comprei umas coisas no mercado');
  assert.equal(draft.amountCents, undefined);
  assert.equal(draft.confidence, 'low');
});
