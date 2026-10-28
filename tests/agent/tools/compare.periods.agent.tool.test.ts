import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { comparePeriodsTool } from '../../../src/app/agent/tools/compare.periods.agent.tool.ts';
import { DEFAULT_TOOL_LIMITS } from '../../../src/app/agent/tools/default.tool.limits.ts';
import { getMonthSummaryTool } from '../../../src/app/agent/tools/get.month.summary.agent.tool.ts';
import { buildSyntheticDatabase } from '../evals/dataset/build.synthetic.database.ts';
import { EVAL_NOW, EVAL_USER_ID } from '../evals/dataset/eval.dataset.ts';

const CTX = {
  userId: EVAL_USER_ID,
  now: EVAL_NOW,
  locale: 'pt-BR' as const,
  limits: DEFAULT_TOOL_LIMITS,
};

describe('compare_periods tool (spec 037, T021)', () => {
  it('compara dois meses por categoria com numeros identicos a get_month_summary e roda em < 50 ms', async () => {
    const ds = await buildSyntheticDatabase();
    const summaryAug = await getMonthSummaryTool(ds.container).run({ month: '2026-08' }, CTX);
    const summarySep = await getMonthSummaryTool(ds.container).run({ month: '2026-09' }, CTX);
    const augExpense = summaryAug.facts.find((f) => f.id === 'despesas')?.value as number;
    const sepExpense = summarySep.facts.find((f) => f.id === 'despesas')?.value as number;

    const started = performance.now();
    const cmp = await comparePeriodsTool(ds.container).run({ a: '2026-08', b: '2026-09', groupBy: 'category', kind: 'expense', top: 5 }, CTX);
    const elapsedMs = performance.now() - started;

    assert.equal(cmp.ok, true);
    assert.ok(elapsedMs < 50, `demorou ${elapsedMs.toFixed(1)} ms`);
    assert.equal(cmp.facts.find((f) => f.id === 'total.a')?.value, augExpense);
    assert.equal(cmp.facts.find((f) => f.id === 'total.b')?.value, sepExpense);
    assert.equal(cmp.facts.find((f) => f.id === 'total.diff')?.value, sepExpense - augExpense);
  });

  it('agrupa por conta e por tipo (kind)', async () => {
    const ds = await buildSyntheticDatabase();
    const byAcc = await comparePeriodsTool(ds.container).run({ a: '2026-08', b: '2026-09', groupBy: 'account', kind: 'expense', top: 10 }, CTX);
    assert.equal(byAcc.ok, true);
    assert.match(byAcc.contentForModel, /Itaú|Nubank/);

    const byKind = await comparePeriodsTool(ds.container).run({ a: '2026-08', b: '2026-09', groupBy: 'kind', kind: 'expense', top: 10 }, CTX);
    assert.equal(byKind.ok, true);
    assert.match(byKind.contentForModel, /Receitas/);
    assert.match(byKind.contentForModel, /Despesas/);
  });

  it('periodo sem lancamentos devolve sem_dados e nunca zero como resultado', async () => {
    const ds = await buildSyntheticDatabase();
    const empty = await comparePeriodsTool(ds.container).run({ a: '2020-01', b: '2026-09', groupBy: 'category', kind: 'expense', top: 5 }, CTX);
    assert.equal(empty.ok, true);
    assert.match(empty.contentForModel, /sem_dados/);
    assert.equal(empty.facts.length, 0);
  });
});

