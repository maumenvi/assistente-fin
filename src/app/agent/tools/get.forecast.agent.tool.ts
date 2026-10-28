import { z } from 'zod';
import { type Fact } from '../../../domain/agent/fact.ts';
import { type ForecastResult } from '../../../domain/forecast/monthly.forecast.ts';
import { formatBrl } from '../verify/format.brl.ts';
import { type AgentTool } from './agent.tool.ts';
import { type AgentToolDeps } from './shared/agent.tool.deps.ts';
import { buildToolResult } from './shared/build.tool.result.ts';
import { monthArgSchema, monthKey, monthLabel, parseMonthArg } from './shared/month.arg.ts';
import { moneyFact } from './shared/money.fact.ts';

/** Maximo de meses por consulta (cada mes gera varios fatos). */
const MAX_MONTHS = 12;

const inputSchema = z
  .object({
    fromMonth: monthArgSchema.describe('Primeiro mes da previsao (AAAA-MM).'),
    toMonth: monthArgSchema.optional().describe('Ultimo mes (AAAA-MM); omita para so um mes.'),
  })
  .refine((v) => v.toMonth === undefined || v.toMonth >= v.fromMonth, { message: 'toMonth deve ser igual ou posterior a fromMonth', path: ['toMonth'] })
  .refine(
    (v) => {
      if (v.toMonth === undefined) return true;
      const a = parseMonthArg(v.fromMonth);
      const b = parseMonthArg(v.toMonth);
      return (b.year - a.year) * 12 + (b.month - a.month) + 1 <= MAX_MONTHS;
    },
    { message: `no maximo ${MAX_MONTHS} meses por consulta`, path: ['toMonth'] },
  );

type Args = z.infer<typeof inputSchema>;

/**
 * `get_forecast` (spec 031, T061): previsao de saldo por mes (ganhos, gastos fixos, estimativa
 * dos demais gastos, faturas de cartao e saldo previsto), pelos mesmos casos de uso das telas
 * de previsao. Somente leitura.
 */
export function getForecastTool(deps: AgentToolDeps): AgentTool<Args> {
  return {
    id: 'get_forecast',
    description:
      'Previsao financeira por mes: ganhos previstos, gastos fixos, estimativa dos demais gastos, faturas de cartao e saldo previsto. Use para "como vai ficar o mes que vem" ou "vou fechar o mes no azul".',
    effect: 'read',
    input: inputSchema,
    async run(args, ctx) {
      const from = parseMonthArg(args.fromMonth);
      const to = args.toMonth === undefined ? from : parseMonthArg(args.toMonth);
      const months = (to.year - from.year) * 12 + (to.month - from.month) + 1;
      const results: readonly ForecastResult[] =
        months === 1
          ? [await deps.getMonthlyForecast.execute({ userId: ctx.userId, month: from })]
          : await deps.getForecastRange.execute({ userId: ctx.userId, from, months });
      const facts: Fact[] = [];
      const lines: string[] = [];
      for (const result of results.slice(0, MAX_MONTHS)) {
        const key = monthKey(result.month);
        facts.push(
          moneyFact(`ganhos.${key}`, `ganhos previstos em ${monthLabel(result.month)}`, result.projectedIncome.cents),
          moneyFact(`fixos.${key}`, `gastos fixos previstos em ${monthLabel(result.month)}`, result.projectedFixedExpenses.cents),
          moneyFact(`variaveis.${key}`, `estimativa dos demais gastos em ${monthLabel(result.month)}`, result.estimatedNonFixedExpenses.cents),
          moneyFact(`faturas.${key}`, `faturas de cartao previstas em ${monthLabel(result.month)}`, result.projectedCreditCardInvoices.cents),
          moneyFact(`saldo.${key}`, `saldo previsto de ${monthLabel(result.month)}`, result.projectedBalance.cents),
        );
        lines.push(
          `- ${monthLabel(result.month)}: ganhos ${formatBrl(result.projectedIncome.cents)}; gastos fixos ${formatBrl(result.projectedFixedExpenses.cents)}; demais gastos estimados ${formatBrl(result.estimatedNonFixedExpenses.cents)}; faturas de cartao ${formatBrl(result.projectedCreditCardInvoices.cents)}; saldo previsto ${formatBrl(result.projectedBalance.cents)}.`,
        );
      }
      return buildToolResult({
        tool: 'get_forecast',
        body: lines.join('\n'),
        facts,
        summary: {
          tool: 'get_forecast',
          label: months === 1 ? `previsao de ${monthLabel(from)}` : `previsao de ${monthLabel(from)} a ${monthLabel(to)}`,
          filters: { de: args.fromMonth, ate: args.toMonth ?? args.fromMonth },
          itemCount: results.length,
          truncated: false,
        },
        maxChars: ctx.limits.maxChars,
      });
    },
  };
}
