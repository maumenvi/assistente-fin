import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isTransferOrCardPayment } from '../../../src/domain/transaction/is.transfer.or.card.payment.ts';

const noGroups = { transferGroupId: null, cardPaymentGroupId: null };
const noFlags = { isSystemTransfer: false, isSystemCardPayment: false };

test('transferGroupId preenchido -> true (spec 018, RF-22, condicao a)', () => {
  assert.equal(
    isTransferOrCardPayment({ transferGroupId: 'g1', cardPaymentGroupId: null }, noFlags),
    true,
  );
});

test('cardPaymentGroupId preenchido -> true (spec 018, RF-22, condicao b)', () => {
  assert.equal(
    isTransferOrCardPayment({ transferGroupId: null, cardPaymentGroupId: 'g1' }, noFlags),
    true,
  );
});

test('categoria isSystemTransfer, sem nenhum grupo preenchido -> true (spec 018, RF-22, condicao c - compatibilidade retroativa)', () => {
  assert.equal(
    isTransferOrCardPayment(noGroups, { isSystemTransfer: true, isSystemCardPayment: false }),
    true,
  );
});

test('categoria isSystemCardPayment, sem nenhum grupo preenchido -> true (spec 018, RF-22, condicao c)', () => {
  assert.equal(
    isTransferOrCardPayment(noGroups, { isSystemTransfer: false, isSystemCardPayment: true }),
    true,
  );
});

test('nenhuma das quatro condicoes -> false', () => {
  assert.equal(isTransferOrCardPayment(noGroups, noFlags), false);
});

test('categoria undefined (ex.: vinculo nao encontrado no indice) -> false, sem lancar', () => {
  assert.doesNotThrow(() => isTransferOrCardPayment(noGroups, undefined));
  assert.equal(isTransferOrCardPayment(noGroups, undefined), false);
});

test('categoria undefined mas grupo preenchido -> true (condicao a/b independe da categoria)', () => {
  assert.equal(
    isTransferOrCardPayment({ transferGroupId: 'g1', cardPaymentGroupId: null }, undefined),
    true,
  );
});
