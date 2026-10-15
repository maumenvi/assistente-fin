import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluatePurchaseViability } from '../../../src/domain/simulation/evaluate.purchase.viability.ts';
import { redactVerdictForLocked } from '../../../src/domain/simulation/redact.verdict.for.locked.ts';
import { type AccountProjection } from '../../../src/domain/simulation/account.projection.ts';

const SEP = { year: 2026, month: 9 };
const itau: AccountProjection = {
  id: 'itau',
  kind: 'account',
  baseCents: 438_215,
  monthlyBalances: [
    { year: 2026, month: 9, cents: 121_040 },
    { year: 2026, month: 10, cents: 300_000 },
  ],
};
const poupanca: AccountProjection = {
  id: 'poupanca',
  kind: 'account',
  baseCents: 900_000,
  monthlyBalances: [
    { year: 2026, month: 9, cents: 900_000 },
    { year: 2026, month: 10, cents: 900_000 },
  ],
};
const nubank: AccountProjection = { id: 'nubank', kind: 'card', baseCents: 500_000, availableCents: 60_000 };

test('conta fica negativa em algum mes -> nao e possivel, com mes e quanto falta', () => {
  const result = evaluatePurchaseViability({
    purchase: { amountCents: 130_000, accountId: 'itau', installments: 1, month: SEP },
    projections: [itau, poupanca, nubank],
    pending: [],
    safetyMargin: 0.2,
  });
  assert.equal(result.withoutPending.level, 'not-possible');
  assert.deepEqual(result.withoutPending.month, SEP);
  assert.equal(result.withoutPending.remainingCents, 121_040 - 130_000);
  assert.equal(result.withPending, undefined);
});

test('sobra menos que a margem -> nao recomendado; acima -> ok', () => {
  const warn = evaluatePurchaseViability({
    purchase: { amountCents: 50_000, accountId: 'itau', installments: 1, month: SEP },
    projections: [itau],
    pending: [],
    safetyMargin: 0.2,
  });
  assert.equal(warn.withoutPending.level, 'not-recommended', '71.040 < 20% de 438.215');
  const ok = evaluatePurchaseViability({
    purchase: { amountCents: 10_000, accountId: 'poupanca', installments: 1, month: SEP },
    projections: [itau, poupanca],
    pending: [],
    safetyMargin: 0.2,
  });
  assert.equal(ok.withoutPending.level, 'ok');
});

test('cartao: estoura o limite -> nao e possivel; margem configuravel muda a faixa', () => {
  const over = evaluatePurchaseViability({
    purchase: { amountCents: 70_000, accountId: 'nubank', installments: 3, month: SEP },
    projections: [nubank],
    pending: [],
    safetyMargin: 0.2,
  });
  assert.equal(over.withoutPending.level, 'not-possible');
  const tight = { purchase: { amountCents: 34_900, accountId: 'nubank', installments: 3, month: SEP }, projections: [nubank], pending: [] };
  assert.equal(evaluatePurchaseViability({ ...tight, safetyMargin: 0.2 }).withoutPending.level, 'not-recommended');
  assert.equal(evaluatePurchaseViability({ ...tight, safetyMargin: 0.05 }).withoutPending.level, 'ok');
});

test('resultado duplo com pre-registros; incerto conta a vista na conta com mais saldo (FR-043)', () => {
  const result = evaluatePurchaseViability({
    purchase: { amountCents: 34_900, accountId: 'nubank', installments: 3, month: SEP },
    projections: [itau, poupanca, nubank],
    pending: [
      { amountCents: 52_900, accountId: 'nubank', installments: 1, month: SEP },
      { amountCents: 850_000, accountId: null, installments: null, month: null },
    ],
    safetyMargin: 0.05,
  });
  assert.equal(result.withoutPending.level, 'ok');
  assert.ok(result.withPending);
  assert.equal(result.withPending.level, 'not-possible', 'o pre-registro no Nubank estoura o limite');
  assert.equal(result.withPending.accountId, 'nubank');
});

test('pre-registro incerto cai na conta com maior saldo, nao na da compra', () => {
  const result = evaluatePurchaseViability({
    purchase: { amountCents: 1_000, accountId: 'itau', installments: 1, month: SEP },
    projections: [itau, poupanca],
    pending: [{ amountCents: 880_000, accountId: null, installments: null, month: null }],
    safetyMargin: 0.2,
  });
  assert.equal(result.withPending?.accountId, 'poupanca');
  assert.equal(result.withPending?.level, 'not-recommended');
});

test('redactVerdictForLocked tira todos os valores (FR-047)', () => {
  const result = evaluatePurchaseViability({
    purchase: { amountCents: 50_000, accountId: 'itau', installments: 1, month: SEP },
    projections: [itau],
    pending: [],
    safetyMargin: 0.2,
  });
  const redacted = redactVerdictForLocked(result.withoutPending);
  assert.deepEqual(Object.keys(redacted).sort(), ['accountId', 'level', 'month']);
});
