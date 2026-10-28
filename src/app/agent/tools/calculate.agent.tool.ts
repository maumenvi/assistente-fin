import { z } from 'zod';
import { compareValues, type NamedCalcOp } from '../../../domain/agent/calc/compare.values.ts';
import { evaluateExpression } from '../../../domain/agent/calc/evaluate.expression.ts';
import { CalcDivisionByZeroError } from '../../../domain/agent/errors/calc.division.by.zero.error.ts';
import { CalcInvalidExpressionError } from '../../../domain/agent/errors/calc.invalid.expression.error.ts';
import { CalcNoDataError } from '../../../domain/agent/errors/calc.no.data.error.ts';
import { type Fact } from '../../../domain/agent/fact.ts';
import { extractFigures } from '../verify/extract.figures.ts';
import { formatBrl } from '../verify/format.brl.ts';
import { type AgentTool } from './agent.tool.ts';
import { buildToolError } from './shared/build.tool.error.ts';
import { buildToolResult } from './shared/build.tool.result.ts';
import { moneyFact } from './shared/money.fact.ts';
import { percentFact } from './shared/percent.fact.ts';

const valueItemSchema = z.union([
  z.number().describe('Valor em centavos inteiros (ex.: 150000 = R$ 1.500,00).'),
  z.object({ fact: z.string().trim().min(1).describe('Id de um fato retornado por consulta anterior.') }),
]);

const inputSchema = z.object({
  op: z
    .enum(['expr', 'sum', 'avg', 'diff', 'pct_of', 'pct_change', 'project'])
    .optional()
    .default('expr')
    .describe('Operacao: "expr" (expressao aritmetica em reais), "sum", "avg", "diff" (v1-v2), "pct_of" (parte/total), "pct_change" ((atual-base)/base) ou "project" (media*meses).'),
  expression: z
    .string()
    .trim()
    .max(240)
    .optional()
    .describe('Expressao aritmetica em reais com + - * / ( ) e %, ex.: "1500 * (1 - 20%)" ou "1234,56 + 65,44". Usada quando op="expr".'),
  values: z
    .array(valueItemSchema)
    .max(200)
    .optional()
    .describe('Valores em centavos inteiros (ou referencias {fact}) para sum, avg, diff, pct_of, pct_change e project.'),
  months: z.number().int().min(1).max(120).optional().describe('Quantidade de meses na projecao (op="project").'),
});

type Args = z.infer<typeof inputSchema>;

function formatPercentBp(bp: number): { readonly numeric: number; readonly display: string } {
  const numeric = Number((bp / 100).toFixed(2));
  const text = Number.isInteger(numeric) ? String(numeric) : numeric.toFixed(2).replace(/\.?0+$/, '').replace('.', ',');
  return { numeric, display: `${text}%` };
}

/**
 * `calculate` (spec 037, FR-003, contracts/agent.tools.md): toda aritmetica (soma, media, diferenca,
 * percentual, projecao, simulacao "e se") e feita de forma exata pelo app e entra no `FactLedger`.
 * O modelo apenas apresenta o resultado.
 */
export function calculateTool(): AgentTool<Args> {
  return {
    id: 'calculate',
    description:
      'Calcula com precisao exata qualquer conta (soma, media, diferenca, percentual, variacao %, projecao ou expressao "e se"). Use SEMPRE que precisar somar, subtrair, calcular percentual ou simular corte/aumento; nunca faca contas de cabeca.',
    effect: 'read',
    input: inputSchema,
    async run(args, ctx) {
      try {
        const op = args.op ?? 'expr';
        if (op === 'expr') {
          if (args.expression === undefined || args.expression.trim() === '') {
            return buildToolError('calculate', { code: 'invalid_args', message: 'informe expression quando op="expr"' });
          }
          const result = evaluateExpression(args.expression);
          const extraFacts: Fact[] = extractFigures(args.expression).flatMap((f, idx) =>
            f.kind === 'percent' ? [percentFact(`termo.${idx + 1}`, `percentual da formula`, Number(f.normalized))] : [],
          );
          const fact = moneyFact('resultado', `calculo: ${result.formula}`, result.value);
          return buildToolResult({
            tool: 'calculate',
            body: `Formula: ${result.formula}\nResultado: ${formatBrl(result.value)}`,
            facts: [fact, ...extraFacts],
            summary: { tool: 'calculate', label: `calculo ${result.formula} = ${formatBrl(result.value)}`, filters: { op: 'expr' }, itemCount: 1, truncated: false },
            maxChars: ctx.limits.maxChars,
          });
        }

        const rawValues = args.values ?? [];
        if (rawValues.length === 0) {
          return buildToolError('calculate', { code: 'invalid_args', message: `informe values para op="${op}"` });
        }
        const ledger = ctx.turn?.ledger ?? [];
        const valuesCents: number[] = [];
        const sources: string[] = [];
        for (const item of rawValues) {
          if (typeof item === 'number') {
            valuesCents.push(Math.round(item));
          } else {
            const found = ledger.find((f) => f.id === item.fact && typeof f.value === 'number');
            if (found === undefined) {
              return buildToolError('calculate', { code: 'invalid_args', message: `fato "${item.fact}" nao encontrado nas consultas anteriores` });
            }
            valuesCents.push(Number(found.value));
            sources.push(found.id);
          }
        }

        const result = compareValues({
          op: op as NamedCalcOp,
          valuesCents,
          ...(args.months === undefined ? {} : { months: args.months }),
          sources,
        });

        if (result.kind === 'percent') {
          const { numeric, display } = formatPercentBp(result.value);
          const fact: Fact = { id: 'resultado', kind: 'percent', value: numeric, display, label: `calculo: ${result.formula}`, sourceCallId: '' };
          return buildToolResult({
            tool: 'calculate',
            body: `Formula: ${result.formula}\nResultado: ${display}`,
            facts: [fact],
            summary: { tool: 'calculate', label: `calculo ${result.formula} = ${display}`, filters: { op }, itemCount: valuesCents.length, truncated: false },
            maxChars: ctx.limits.maxChars,
          });
        }

        const fact = moneyFact('resultado', `calculo: ${result.formula}`, result.value);
        return buildToolResult({
          tool: 'calculate',
          body: `Formula: ${result.formula}\nResultado: ${formatBrl(result.value)}`,
          facts: [fact],
          summary: { tool: 'calculate', label: `calculo ${result.formula} = ${formatBrl(result.value)}`, filters: { op }, itemCount: valuesCents.length, truncated: false },
          maxChars: ctx.limits.maxChars,
        });
      } catch (error) {
        if (error instanceof CalcDivisionByZeroError || error instanceof CalcInvalidExpressionError || error instanceof CalcNoDataError) {
          return buildToolError('calculate', { code: 'invalid_args', message: error.message });
        }
        throw error;
      }
    },
  };
}
