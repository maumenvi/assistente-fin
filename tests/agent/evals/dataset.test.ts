import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildSyntheticDatabase } from './dataset/build.synthetic.database.ts';
import { uncategorizedStats } from './dataset/dataset.facts.ts';
import { EVAL_USER_ID } from './dataset/eval.dataset.ts';

describe('base sintetica de avaliacao', () => {
  it('tem o tamanho exigido: 3 contas + 2 cartoes, >= 600 lancamentos em 12 meses, 40+ sem categoria (1 ambiguo PIX Joao), gastos fixos, ganho e limites', async () => {
    const ds = await buildSyntheticDatabase();
    const accounts = await ds.container.listAccounts.execute({ userId: EVAL_USER_ID });
    assert.equal(accounts.filter((a) => a.kind !== 'credit-card').length, 3);
    assert.equal(accounts.filter((a) => a.kind === 'credit-card').length, 2);
    const transactions = await ds.container.listTransactions.execute({ userId: EVAL_USER_ID });
    assert.ok(transactions.length >= 600, `so ${transactions.length}`);
    const months = new Set(transactions.map(({ item }) => item.date.toISOString().slice(0, 7)));
    assert.ok(months.size >= 12, `meses: ${months.size}`);
    assert.equal((await ds.container.listFixedExpenses.execute({ userId: EVAL_USER_ID })).length, 3);
    assert.equal((await ds.container.listSpendingLimitsWithUsage.execute({ userId: EVAL_USER_ID })).length, 3);
    assert.ok(transactions.some(({ item }) => item.installmentTotal !== null));
    const pending = await uncategorizedStats(ds);
    assert.ok(pending.count >= 40, `pendentes: ${pending.count}`);
    assert.ok(pending.totalCents > 0);
    assert.ok(transactions.some(({ item, categoryName }) => categoryName === 'SEM CATEGORIA' && item.notes === 'PIX João'));
  });

  it('e deterministico: dois builds produzem exatamente os mesmos lancamentos', async () => {
    const snapshot = async () => {
      const ds = await buildSyntheticDatabase();
      const rows = await ds.container.listTransactions.execute({ userId: EVAL_USER_ID });
      return JSON.stringify(rows.map(({ item }) => [item.id, item.date.toISOString(), item.amount.cents, item.categoryId, item.accountId]));
    };
    assert.equal(await snapshot(), await snapshot());
  });
});
