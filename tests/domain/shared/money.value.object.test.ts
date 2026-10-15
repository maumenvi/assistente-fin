import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Money } from '../../../src/domain/shared/money.value.object.ts';
import { InvalidMoneyAmountError } from '../../../src/domain/shared/invalid.money.amount.error.ts';
import { CurrencyMismatchError } from '../../../src/domain/shared/currency.mismatch.error.ts';

test('fromCents exige inteiro seguro', () => {
  assert.equal(Money.fromCents(1050).cents, 1050);
  assert.throws(() => Money.fromCents(10.5), InvalidMoneyAmountError);
  assert.throws(() => Money.fromCents(Number.NaN), InvalidMoneyAmountError);
  assert.throws(() => Money.fromCents(Number.MAX_SAFE_INTEGER + 2), InvalidMoneyAmountError);
});

test('fromDecimal converte para centavos arredondando', () => {
  assert.equal(Money.fromDecimal(10.5).cents, 1050);
  assert.equal(Money.fromDecimal(0.1 + 0.2).cents, 30);
  assert.equal(Money.fromDecimal(-0.005).cents, 0);
  assert.throws(() => Money.fromDecimal(Number.POSITIVE_INFINITY), InvalidMoneyAmountError);
});

test('add e subtract sao puros e nao mutam', () => {
  const a = Money.fromCents(1000);
  const b = Money.fromCents(250);

  assert.equal(a.add(b).cents, 1250);
  assert.equal(a.subtract(b).cents, 750);
  assert.equal(a.cents, 1000, 'instancia original intacta');
  assert.equal(a.subtract(Money.fromCents(1500)).cents, -500);
});

test('multiply arredonda para o centavo', () => {
  assert.equal(Money.fromCents(1000).multiply(3).cents, 3000);
  assert.equal(Money.fromCents(1000).multiply(1 / 3).cents, 333);
  assert.throws(() => Money.fromCents(100).multiply(Number.NaN), InvalidMoneyAmountError);
});

test('compare, equals e predicados de sinal', () => {
  const ten = Money.fromCents(1000);
  const twenty = Money.fromCents(2000);

  assert.equal(ten.compare(twenty), -1);
  assert.equal(twenty.compare(ten), 1);
  assert.equal(ten.compare(Money.fromCents(1000)), 0);
  assert.equal(ten.equals(Money.fromCents(1000)), true);
  assert.equal(Money.fromCents(-1).isNegative(), true);
  assert.equal(Money.zero().isZero(), true);
  assert.equal(ten.isPositive(), true);
});

test('operacoes entre moedas diferentes falham', () => {
  const brl = Money.fromCents(1000, 'BRL');
  const other = Money.fromCents(1000, 'BRL');
  // Forca uma moeda distinta contornando o tipo para exercitar a guarda.
  Object.assign(other, { currency: 'USD' });

  assert.throws(() => brl.add(other), CurrencyMismatchError);
  assert.equal(brl.equals(other), false);
});

test('format usa a moeda e o locale', () => {
  const formatted = Money.fromCents(123456).format('pt-BR');
  assert.match(formatted, /1\.234,56/);
});
