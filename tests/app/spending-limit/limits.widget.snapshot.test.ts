import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decodeLimitsWidgetSnapshot, encodeLimitsWidgetSnapshot, freshSnapshot } from '../../../src/app/spending-limit/limits.widget.snapshot.ts';

/** Resumo do widget guardado no aparelho (spec 023, T008). */
const data = {
  month: { year: 2026, month: 9 },
  spendingLimits: [{ id: 'l1', name: 'COMBUSTIVEL', kind: 'spending-limit' as const, usedPercent: 32, status: 'normal' as const }],
  cards: [],
};

test('ida e volta', () => {
  const snapshot = freshSnapshot(data, new Date('2026-09-25T12:00:00.000Z'));
  assert.deepEqual(decodeLimitsWidgetSnapshot(encodeLimitsWidgetSnapshot(snapshot)), snapshot);
});

test('ausente, JSON invalido, forma errada ou versao desconhecida = sem resumo', () => {
  assert.equal(decodeLimitsWidgetSnapshot(null), null);
  assert.equal(decodeLimitsWidgetSnapshot('{nao e json'), null);
  assert.equal(decodeLimitsWidgetSnapshot(JSON.stringify({ version: 1 })), null);
  const other = { ...freshSnapshot(data, new Date()), version: 2 };
  assert.equal(decodeLimitsWidgetSnapshot(JSON.stringify(other)), null);
});

test('o resumo so tem nomes e percentuais (FR-011)', () => {
  const text = encodeLimitsWidgetSnapshot(freshSnapshot(data, new Date()));
  assert.doesNotMatch(text, /cents|amount|valor/i);
});
