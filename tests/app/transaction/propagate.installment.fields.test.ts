import assert from 'node:assert/strict';
import { test } from 'node:test';
import { propagateInstallmentFields } from '../../../src/app/transaction/propagate.installment.fields.ts';

const parcela = { installmentGroupId: 'grupo-1', categoryId: 'cat-antiga', notes: undefined };
const avulso = { installmentGroupId: null, categoryId: 'cat-antiga', notes: undefined };

test('transacao que nao e parcela nunca propaga (spec 009, RF-7 preservado)', () => {
  const result = propagateInstallmentFields(avulso, {
    categoryId: 'cat-nova',
    notes: 'qualquer',
    notesTouched: true,
  });

  assert.equal(result, null);
});

test('categoria mudou -> propaga so a categoria', () => {
  const result = propagateInstallmentFields(parcela, {
    categoryId: 'cat-nova',
    notes: undefined,
    notesTouched: false,
  });

  assert.deepEqual(result, { categoryId: 'cat-nova' });
});

test('notas mudaram -> propaga so as notas', () => {
  const result = propagateInstallmentFields(parcela, {
    categoryId: 'cat-antiga',
    notes: 'compra do mes',
    notesTouched: true,
  });

  assert.deepEqual(result, { notes: 'compra do mes' });
});

test('categoria e notas mudaram -> propaga as duas', () => {
  const result = propagateInstallmentFields(parcela, {
    categoryId: 'cat-nova',
    notes: 'compra do mes',
    notesTouched: true,
  });

  assert.deepEqual(result, { categoryId: 'cat-nova', notes: 'compra do mes' });
});

test('nada relevante mudou -> null (nao carrega o grupo a toa)', () => {
  const result = propagateInstallmentFields(parcela, {
    categoryId: 'cat-antiga',
    notes: undefined,
    notesTouched: false,
  });

  assert.equal(result, null);
});

test('editar so valor/data/conta nao propaga: esses campos nem chegam aqui', () => {
  // a assinatura so recebe categoria e notas - valor, data e conta sao por parcela (RF-51) e
  // nao tem como vazar para a propagacao nem por engano.
  const result = propagateInstallmentFields(parcela, {
    categoryId: 'cat-antiga',
    notes: undefined,
    notesTouched: false,
  });

  assert.equal(result, null);
});

test('notas apagadas propagam como apagadas, nao como "nao mexeu"', () => {
  const comNotas = { installmentGroupId: 'grupo-1', categoryId: 'cat-antiga', notes: 'antiga' };

  const result = propagateInstallmentFields(comNotas, {
    categoryId: 'cat-antiga',
    notes: undefined,
    notesTouched: true,
  });

  assert.deepEqual(result, { notes: undefined });
});

test('notas reescritas com o mesmo texto ainda propagam (alinha irmas divergentes, RF-51a)', () => {
  const comNotas = { installmentGroupId: 'grupo-1', categoryId: 'cat-antiga', notes: 'igual' };

  const result = propagateInstallmentFields(comNotas, {
    categoryId: 'cat-antiga',
    notes: 'igual',
    notesTouched: true,
  });

  assert.deepEqual(result, { notes: 'igual' });
});
