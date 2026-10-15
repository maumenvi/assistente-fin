import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Transaction } from '../../../../src/domain/transaction/transaction.entity.ts';
import { Account } from '../../../../src/domain/account/account.entity.ts';
import { Category } from '../../../../src/domain/category/category.entity.ts';
import { CategoryName } from '../../../../src/domain/category/category.name.value.object.ts';
import { Money } from '../../../../src/domain/shared/money.value.object.ts';
import { toAgentTransactionRow } from '../../../../src/app/ai-exchange/export/dto/agent.transaction.row.ts';
import { toAgentAccount } from '../../../../src/app/ai-exchange/export/dto/to.agent.account.ts';
import { toAgentCategory } from '../../../../src/app/ai-exchange/export/dto/to.agent.category.ts';
import { TRANSACTION_COLUMNS } from '../../../../src/app/ai-exchange/format/agent.payload.ts';

test('a linha da transacao segue a ordem das colunas do contrato (spec 029, R6)', () => {
  const tx = Transaction.create({
    id: 'tx1',
    userId: 'u1',
    date: new Date('2026-10-13T00:00:00.000Z'),
    amount: Money.fromCents(2350),
    type: 'expense',
    categoryId: 'c1',
    accountId: 'a1',
    notes: 'Padaria',
  });
  const row = toAgentTransactionRow(tx);
  assert.equal(row.length, TRANSACTION_COLUMNS.length);
  const byColumn = Object.fromEntries(TRANSACTION_COLUMNS.map((column, index) => [column, row[index]]));
  assert.equal(byColumn['date'], '2026-10-13');
  assert.equal(byColumn['amountCents'], 2350);
  assert.equal(byColumn['type'], 'expense');
  assert.equal(byColumn['notes'], 'Padaria');
  assert.equal(byColumn['installmentGroupId'], null);
});

test('conta e categoria no formato do agente', () => {
  const account = Account.create({ id: 'a1', userId: 'u1', name: 'Itau', kind: 'checking', openingBalance: Money.zero() });
  assert.deepEqual(toAgentAccount(account), { id: 'a1', name: 'Itau', kind: 'checking', archived: false });
  const category = Category.create({ id: 'c1', userId: 'u1', name: CategoryName.create('Mercado'), isDefault: false });
  assert.deepEqual(toAgentCategory(category), { id: 'c1', name: 'MERCADO', isDefault: false });
});
