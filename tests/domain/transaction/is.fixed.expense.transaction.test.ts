import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isFixedExpenseTransaction } from '../../../src/domain/transaction/is.fixed.expense.transaction.ts';

test('transacao gerada por gasto fixo devolve true (spec 021, RF-59)', () => {
  assert.equal(isFixedExpenseTransaction({ fixedExpenseId: 'fx-1' }), true);
});

test('transacao comum devolve false', () => {
  assert.equal(isFixedExpenseTransaction({ fixedExpenseId: null }), false);
});

/**
 * Os dois testes abaixo sao o ponto da tipagem estrutural (plano, research R5): a mesma funcao
 * precisa aceitar tanto a entidade de dominio (usada pela previsao) quanto o DTO da IPC (usado
 * pelo Dashboard). Se alguem trocar a assinatura para `Transaction`, um destes para de compilar
 * - que e exatamente o alarme que se quer.
 */
test('aceita um objeto no shape da entidade Transaction (consumidor: previsao)', () => {
  const entityLike = {
    id: 't1',
    userId: 'u1',
    fixedExpenseId: 'fx-1',
    accountId: 'acc-1',
    categoryId: 'cat-1',
  };

  assert.equal(isFixedExpenseTransaction(entityLike), true);
});

test('aceita um objeto no shape do TransactionDto (consumidor: Dashboard)', () => {
  const dtoLike = {
    id: 't1',
    date: '2026-09-16T00:00:00.000Z',
    amountCents: 35_000,
    fixedExpenseId: 'fx-1',
    categoryName: 'ALUGUEL',
  };

  assert.equal(isFixedExpenseTransaction(dtoLike), true);
});
