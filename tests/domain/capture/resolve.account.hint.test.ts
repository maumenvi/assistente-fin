import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveAccountHint } from '../../../src/domain/capture/resolve.account.hint.ts';

const accounts = [
  { id: 'itau', name: 'Itaú' },
  { id: 'iti', name: 'Iti' },
  { id: 'nubank', name: 'Nubank Roxinho' },
  { id: 'c1', name: 'Caixa' },
  { id: 'c2', name: 'Caixa Poupança' },
];

test('casa sem acento e sem caixa, por nome exato ou contido', () => {
  assert.equal(resolveAccountHint('itau', accounts), 'itau');
  assert.equal(resolveAccountHint('ITI', accounts), 'iti');
  assert.equal(resolveAccountHint('nubank', accounts), 'nubank');
  assert.equal(resolveAccountHint('no itaú', accounts), 'itau');
});

test('ambiguo ou nenhum -> undefined', () => {
  assert.equal(resolveAccountHint('bradesco', accounts), undefined);
  assert.equal(resolveAccountHint('', accounts), undefined);
  assert.equal(resolveAccountHint(undefined, accounts), undefined);
  assert.equal(resolveAccountHint('caixa', accounts), 'c1', 'exato vence o contido');
  assert.equal(resolveAccountHint('poupanca caixa', [{ id: 'a', name: 'Caixa' }, { id: 'b', name: 'Poupança' }]), undefined);
});
