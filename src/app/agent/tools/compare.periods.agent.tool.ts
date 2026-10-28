import { z } from 'zod';
import { pctChangeBp } from '../../../domain/agent/calc/compare.values.ts';
import { type Fact } from '../../../domain/agent/fact.ts';
import { summarizeDashboardMonth } from '../../dashboard/summarize.dashboard.month.ts';
import { formatBrl } from '../verify/format.brl.ts';
import { type AgentTool } from './agent.tool.ts';
import { type AgentToolDeps } from './shared/agent.tool.deps.ts';
import { buildToolResult } from './shared/build.tool.result.ts';
import { monthArgSchema, monthLabel, parseMonthArg } from './shared/month.arg.ts';
import { monthBounds } from './shared/month.bounds.ts';
import { moneyFact } from './shared/money.fact.ts';
import { percentFact } from './shared/percent.fact.ts';
import { sanitizeText } from './shared/sanitize.text.ts';
import { toDashboardTransaction } from './shared/to.dashboard.transaction.ts';

const dateIso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use AAAA-MM-DD');
const periodSchema = z.union([
  monthArgSchema,
  z.object({ from: dateIso, to: dateIso }),
]);

const inputSchema = z.object({
  a: periodSchema.describe('Periodo base (ex.: "2026-08" ou { from: "2026-08-01", to: "2026-08-31" }).'),
  b: periodSchema.describe('Periodo comparado (ex.: "2026-09" ou { from: "2026-09-01", to: "2026-09-30" }).'),
  groupBy: z.enum(['category', 'account', 'kind']).optional().default('category').describe('Agrupamento: "category" (padrao), "account" ou "kind" (receitas vs despesas).'),
  kind: z.enum(['expense', 'income']).optional().default('expense').describe('Tipo quando groupBy="category" ou "account": "expense" (padrao) ou "income".'),
  top: z.number().int().min(1).max(20).optional().default(10).describe('Maximo de linhas na tabela (1..20, padrao 10).'),
});

type Args = z.infer<typeof inputSchema>;

interface ResolvedPeriod {
  readonly label: string;
  readonly from: string;
  readonly to: string;
  readonly month: { readonly year: number; readonly month: number } | null;
}

function resolvePeriod(p: z.infer<typeof periodSchema>): ResolvedPeriod {
  if (typeof p === 'string') {
    const m = parseMonthArg(p);
    const bounds = monthBounds(m);
    return { label: monthLabel(m), from: bounds.from, to: bounds.to, month: m };
  }
  return { label: `${p.from}..${p.to}`, from: p.from, to: p.to, month: null };
}

function formatPct(bp: number | null): string {
  if (bp === null) return 'sem base';
  const pct = Number((bp / 100).toFixed(2));
  const sign = pct > 0 ? '+' : '';
  const text = Number.isInteger(pct) ? String(pct) : pct.toFixed(2).replace(/\.?0+$/, '').replace('.', ',');
  return `${sign}${text}%`;
}

function addPctFact(facts: Fact[], id: string, label: string, bp: number | null): void {
  if (bp === null) return;
  const pct = Number((bp / 100).toFixed(2));
  facts.push(percentFact(id, label, pct));
}

/**
 * `compare_periods` (spec 037, FR-004, contracts/agent.tools.md): compara dois periodos por
 * categoria, conta ou tipo (receitas vs despesas), com diferenca absoluta (R$) e variacao (%),
 * consistente com `get_month_summary` e as telas. Periodo sem lancamentos devolve `sem_dados`.
 */
export function comparePeriodsTool(deps: AgentToolDeps): AgentTool<Args> {
  return {
    id: 'compare_periods',
    description:
      'Compara dois meses ou intervalos de datas por categoria, conta ou tipo (receitas vs despesas), trazendo os valores exatos de cada periodo, a diferenca em R$ e a variacao em %. Use para "quanto gastei a mais/menos que em...", "compare os ultimos meses" ou "o que mais cresceu".',
    effect: 'read',
    input: inputSchema,
    async run(args, ctx) {
      const periodA = resolvePeriod(args.a);
      const periodB = resolvePeriod(args.b);
      const groupBy = args.groupBy ?? 'category';
      const kind = args.kind ?? 'expense';
      const top = args.top ?? 10;

      const [accounts, listed, fixed] = await Promise.all([
        deps.listAccounts.execute({ userId: ctx.userId }),
        deps.listTransactions.execute({ userId: ctx.userId }),
        deps.listFixedExpenses.execute({ userId: ctx.userId }),
      ]);

      const inRange = (iso: string, p: ResolvedPeriod): boolean => iso >= p.from && iso <= p.to;
      const rowsA = listed.filter(({ item }) => inRange(item.date.toISOString().slice(0, 10), periodA));
      const rowsB = listed.filter(({ item }) => inRange(item.date.toISOString().slice(0, 10), periodB));

      if (rowsA.length === 0 || rowsB.length === 0) {
        const emptyLabel = rowsA.length === 0 && rowsB.length === 0 ? `${periodA.label} e ${periodB.label}` : rowsA.length === 0 ? periodA.label : periodB.label;
        return buildToolResult({
          tool: 'compare_periods',
          body: `sem_dados: nao ha lancamentos registrados em ${emptyLabel} para comparar.`,
          facts: [],
          summary: { tool: 'compare_periods', label: `comparacao ${periodA.label} vs ${periodB.label} (sem dados)`, filters: { a: periodA.label, b: periodB.label }, itemCount: 0, truncated: false },
          maxChars: ctx.limits.maxChars,
        });
      }

      const dashboardTx = listed.map(toDashboardTransaction);
      const dashboardAcc = accounts.map((account) => ({
        id: account.id,
        kind: account.kind,
        isBenefit: account.isBenefit,
        openingBalanceDate: account.openingBalanceDate?.toISOString() ?? null,
      }));
      const dashboardFixed = fixed.map(({ item, categoryName }) => ({
        categoryId: item.categoryId,
        categoryName,
        expectedAmountCents: item.expectedAmount.cents,
      }));

      interface Row {
        readonly id: string;
        readonly label: string;
        readonly aCents: number;
        readonly bCents: number;
      }

      let rows: Row[] = [];
      let totalACents = 0;
      let totalBCents = 0;
      const extraFacts: Fact[] = [];

      if (groupBy === 'category' && periodA.month !== null && periodB.month !== null) {
        const sumA = summarizeDashboardMonth(dashboardTx, dashboardAcc, dashboardFixed, periodA.month);
        const sumB = summarizeDashboardMonth(dashboardTx, dashboardAcc, dashboardFixed, periodB.month);
        const listA = kind === 'expense' ? sumA.expenseByCategory : sumA.incomeByCategory;
        const listB = kind === 'expense' ? sumB.expenseByCategory : sumB.incomeByCategory;
        totalACents = kind === 'expense' ? sumA.totalExpenseCents : sumA.totalIncomeCents;
        totalBCents = kind === 'expense' ? sumB.totalExpenseCents : sumB.totalIncomeCents;
        const mapA = new Map(listA.map((r) => [r.categoryId, r]));
        const mapB = new Map(listB.map((r) => [r.categoryId, r]));
        const ids = new Set([...mapA.keys(), ...mapB.keys()]);
        rows = [...ids].map((id) => ({
          id,
          label: sanitizeText(mapB.get(id)?.categoryName ?? mapA.get(id)?.categoryName ?? id, 40),
          aCents: mapA.get(id)?.totalCents ?? 0,
          bCents: mapB.get(id)?.totalCents ?? 0,
        }));
        // Fatos adicionais da soma direta do extrato (sem gastos fixos), para perguntas de extrato puro
        const txOnlyA = rowsA.filter(({ item }) => item.type === kind).reduce((s, { item }) => s + item.amount.cents, 0);
        const txOnlyB = rowsB.filter(({ item }) => item.type === kind).reduce((s, { item }) => s + item.amount.cents, 0);
        extraFacts.push(
          moneyFact('extrato.a', `extrato ${periodA.label}`, txOnlyA),
          moneyFact('extrato.b', `extrato ${periodB.label}`, txOnlyB),
          moneyFact('extrato.diff', `diferenca extrato`, txOnlyB - txOnlyA),
        );
        addPctFact(extraFacts, 'extrato.pct', `variacao extrato`, pctChangeBp(txOnlyA, txOnlyB));
      } else if (groupBy === 'kind' && periodA.month !== null && periodB.month !== null) {
        const sumA = summarizeDashboardMonth(dashboardTx, dashboardAcc, dashboardFixed, periodA.month);
        const sumB = summarizeDashboardMonth(dashboardTx, dashboardAcc, dashboardFixed, periodB.month);
        rows = [
          { id: 'income', label: 'Receitas', aCents: sumA.totalIncomeCents, bCents: sumB.totalIncomeCents },
          { id: 'expense', label: 'Despesas', aCents: sumA.totalExpenseCents, bCents: sumB.totalExpenseCents },
        ];
        totalACents = sumA.balanceCents;
        totalBCents = sumB.balanceCents;
      } else if (groupBy === 'account') {
        const accName = new Map(accounts.map((a) => [a.id, sanitizeText(a.name, 40)]));
        const sumByAcc = (list: typeof rowsA): Map<string, number> => {
          const m = new Map<string, number>();
          for (const { item } of list) {
            if (item.type !== kind) continue;
            m.set(item.accountId, (m.get(item.accountId) ?? 0) + item.amount.cents);
          }
          return m;
        };
        const mapA = sumByAcc(rowsA);
        const mapB = sumByAcc(rowsB);
        const ids = new Set([...mapA.keys(), ...mapB.keys()]);
        rows = [...ids].map((id) => ({
          id,
          label: accName.get(id) ?? id,
          aCents: mapA.get(id) ?? 0,
          bCents: mapB.get(id) ?? 0,
        }));
        totalACents = rows.reduce((s, r) => s + r.aCents, 0);
        totalBCents = rows.reduce((s, r) => s + r.bCents, 0);
      } else {
        const sumByCat = (list: typeof rowsA): Map<string, { name: string; cents: number }> => {
          const m = new Map<string, { name: string; cents: number }>();
          for (const { item, categoryName } of list) {
            if (item.type !== kind) continue;
            const prev = m.get(item.categoryId);
            m.set(item.categoryId, { name: sanitizeText(categoryName, 40), cents: (prev?.cents ?? 0) + item.amount.cents });
          }
          return m;
        };
        const mapA = sumByCat(rowsA);
        const mapB = sumByCat(rowsB);
        const ids = new Set([...mapA.keys(), ...mapB.keys()]);
        rows = [...ids].map((id) => ({
          id,
          label: mapB.get(id)?.name ?? mapA.get(id)?.name ?? id,
          aCents: mapA.get(id)?.cents ?? 0,
          bCents: mapB.get(id)?.cents ?? 0,
        }));
        totalACents = rows.reduce((s, r) => s + r.aCents, 0);
        totalBCents = rows.reduce((s, r) => s + r.bCents, 0);
      }

      const sorted = [...rows].sort((x, y) => Math.abs(y.bCents - y.aCents) - Math.abs(x.bCents - x.aCents));
      const shown = sorted.slice(0, top);
      const totalDiffCents = totalBCents - totalACents;
      const totalPctBp = pctChangeBp(totalACents, totalBCents);

      const facts: Fact[] = [
        moneyFact('total.a', `total ${periodA.label}`, totalACents),
        moneyFact('total.b', `total ${periodB.label}`, totalBCents),
        moneyFact('total.diff', `diferenca (${periodB.label} - ${periodA.label})`, totalDiffCents),
        ...extraFacts,
      ];
      addPctFact(facts, 'total.pct', `variacao percentual total`, totalPctBp);

      const lines = [
        `Comparacao: ${periodA.label} (A) vs ${periodB.label} (B) — agrupado por ${groupBy}`,
        `Total A (${periodA.label}): ${formatBrl(totalACents)}`,
        `Total B (${periodB.label}): ${formatBrl(totalBCents)}`,
        `Diferenca (B - A): ${formatBrl(totalDiffCents)} (${formatPct(totalPctBp)})`,
        'Por item (A -> B | diferenca | %):',
      ];
      for (const row of shown) {
        const diff = row.bCents - row.aCents;
        const bp = pctChangeBp(row.aCents, row.bCents);
        facts.push(
          moneyFact(`item.${row.id}.a`, `${row.label} em ${periodA.label}`, row.aCents),
          moneyFact(`item.${row.id}.b`, `${row.label} em ${periodB.label}`, row.bCents),
          moneyFact(`item.${row.id}.diff`, `diferenca de ${row.label}`, diff),
        );
        addPctFact(facts, `item.${row.id}.pct`, `variacao % de ${row.label}`, bp);
        lines.push(`- ${row.label}: ${formatBrl(row.aCents)} -> ${formatBrl(row.bCents)} | ${formatBrl(diff)} (${formatPct(bp)})`);
      }

      return buildToolResult({
        tool: 'compare_periods',
        body: lines.join('\n'),
        facts,
        summary: {
          tool: 'compare_periods',
          label: `comparacao ${periodA.label} vs ${periodB.label}`,
          filters: { a: periodA.label, b: periodB.label, groupBy },
          itemCount: shown.length,
          truncated: sorted.length > shown.length,
        },
        maxChars: ctx.limits.maxChars,
      });
    },
  };
}

