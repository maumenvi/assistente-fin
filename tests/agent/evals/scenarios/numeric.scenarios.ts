import { evaluateExpression } from '../../../../src/domain/agent/calc/evaluate.expression.ts';
import { compareValues } from '../../../../src/domain/agent/calc/compare.values.ts';
import { brl, expenseTotal, monthSummary } from '../dataset/dataset.facts.ts';
import { type EvalScenario } from './eval.scenario.ts';

const COMPARE_PAIRS: readonly (readonly [string, string, string, string])[] = [
  ['2026-08', 'agosto', '2026-09', 'setembro'],
  ['2026-07', 'julho', '2026-08', 'agosto'],
  ['2026-09', 'setembro', '2026-10', 'outubro'],
  ['2026-06', 'junho', '2026-09', 'setembro'],
  ['2026-05', 'maio', '2026-10', 'outubro'],
];

const compareScenarios: EvalScenario[] = COMPARE_PAIRS.map(([a, nameA, b, nameB]) => ({
  id: `numeric.compare.${a}.vs.${b}`,
  category: 'numeric',
  question: `Compare meus gastos de ${nameA} de 2026 com ${nameB} de 2026.`,
  calls: [{ name: 'compare_periods', args: { a, b, groupBy: 'category', kind: 'expense' } }],
  figures: async (ds) => {
    const sa = await monthSummary(ds, a);
    const sb = await monthSummary(ds, b);
    return [brl(sa.expense), brl(sb.expense), brl(sb.expense - sa.expense)];
  },
  answer: ([expA, expB, diff]) => `Em ${nameA} os gastos foram ${expA} e em ${nameB} foram ${expB} (diferença de ${diff}).`,
}));

const COMPARE_BY_ACCOUNT: readonly (readonly [string, string, string, string])[] = [
  ['2026-08', 'agosto', '2026-09', 'setembro'],
  ['2026-09', 'setembro', '2026-10', 'outubro'],
  ['2026-07', 'julho', '2026-09', 'setembro'],
];

const compareAccountScenarios: EvalScenario[] = COMPARE_BY_ACCOUNT.map(([a, nameA, b, nameB]) => ({
  id: `numeric.compare.account.${a}.vs.${b}`,
  category: 'numeric',
  question: `Compare os gastos por conta entre ${nameA} e ${nameB} de 2026.`,
  calls: [{ name: 'compare_periods', args: { a, b, groupBy: 'account', kind: 'expense' } }],
  figures: async (ds) => {
    const expA = await expenseTotal(ds, { month: a });
    const expB = await expenseTotal(ds, { month: b });
    return [brl(expA), brl(expB)];
  },
  answer: ([expA, expB]) => `Comparando por conta entre ${nameA} e ${nameB} de 2026: total A ${expA} e total B ${expB}.`,
}));

const EXPR_CASES: readonly (readonly [string, string, string])[] = [
  ['soma.simples', 'Quanto dá R$ 1.250,50 mais R$ 349,50?', '1250,50 + 349,50'],
  ['subtracao.simples', 'Quanto sobra de R$ 5.000,00 tirando R$ 1.845,25?', '5000 - 1845,25'],
  ['corte.10pct', 'Se eu cortar 10% de R$ 2.400,00, quanto fica?', '2400 * (1 - 10%)'],
  ['corte.15pct', 'Se eu cortar 15% de R$ 1.800,00, quanto fica?', '1800 * (1 - 15%)'],
  ['corte.20pct', 'Se eu cortar 20% de R$ 1.500,00, quanto fica?', '1500 * (1 - 20%)'],
  ['corte.25pct', 'Se eu cortar 25% de R$ 3.200,00, quanto fica?', '3200 * (1 - 25%)'],
  ['corte.30pct', 'Se eu cortar 30% de R$ 950,00, quanto fica?', '950 * (1 - 30%)'],
  ['economia.20pct.anual', 'Se eu economizar 20% de R$ 1.500,00 por 12 meses, quanto junto?', '(1500 * 20%) * 12'],
  ['economia.15pct.semestral', 'Se eu economizar 15% de R$ 2.000,00 por 6 meses, quanto junto?', '(2000 * 15%) * 6'],
  ['divisao.3.meses', 'Qual a média mensal de R$ 4.500,00 divididos em 3 meses?', '4500 / 3'],
  ['divisao.4.parcelas', 'Quanto fica R$ 1.000,00 dividido em 4 parcelas iguais?', '1000 / 4'],
  ['precedencia.parenteses', 'Quanto é (R$ 800,00 + R$ 400,00) vezes 2?', '(800 + 400) * 2'],
  ['acrescimo.10pct', 'Quanto fica R$ 1.200,00 com acréscimo de 10%?', '1200 * (1 + 10%)'],
  ['acrescimo.5pct', 'Quanto fica R$ 3.000,00 com acréscimo de 5%?', '3000 * (1 + 5%)'],
];

const exprScenarios: EvalScenario[] = EXPR_CASES.map(([slug, question, expression]) => ({
  id: `numeric.expr.${slug}`,
  category: 'numeric',
  question,
  calls: [{ name: 'calculate', args: { op: 'expr', expression } }],
  figures: async () => {
    const r = evaluateExpression(expression);
    return [brl(r.value)];
  },
  answer: ([val]) => `Pelo cálculo exato, o resultado é ${val}.`,
}));

const NAMED_OPS: EvalScenario[] = [
  {
    id: 'numeric.op.sum.tres',
    category: 'numeric',
    question: 'Qual a soma de R$ 450,00, R$ 750,00 e R$ 300,00?',
    calls: [{ name: 'calculate', args: { op: 'sum', values: [45_000, 75_000, 30_000] } }],
    figures: async () => [brl(compareValues({ op: 'sum', valuesCents: [45_000, 75_000, 30_000] }).value)],
    answer: ([val]) => `A soma exata é ${val}.`,
  },
  {
    id: 'numeric.op.avg.tres',
    category: 'numeric',
    question: 'Qual a média entre R$ 1.200,00, R$ 1.500,00 e R$ 1.800,00?',
    calls: [{ name: 'calculate', args: { op: 'avg', values: [120_000, 150_000, 180_000] } }],
    figures: async () => [brl(compareValues({ op: 'avg', valuesCents: [120_000, 150_000, 180_000] }).value)],
    answer: ([val]) => `A média exata dos 3 valores é ${val}.`,
  },
  {
    id: 'numeric.op.diff',
    category: 'numeric',
    question: 'Qual a diferença entre R$ 3.400,00 e R$ 2.150,00?',
    calls: [{ name: 'calculate', args: { op: 'diff', values: [340_000, 215_000] } }],
    figures: async () => [brl(compareValues({ op: 'diff', valuesCents: [340_000, 215_000] }).value)],
    answer: ([val]) => `A diferença é ${val}.`,
  },
  {
    id: 'numeric.op.project.6m',
    category: 'numeric',
    question: 'Quanto dá R$ 650,00 por mês projetado em 6 meses?',
    calls: [{ name: 'calculate', args: { op: 'project', values: [65_000], months: 6 } }],
    figures: async () => [brl(compareValues({ op: 'project', valuesCents: [65_000], months: 6 }).value)],
    answer: ([val]) => `Em 6 meses, o valor projetado é ${val}.`,
  },
  {
    id: 'numeric.op.project.12m',
    category: 'numeric',
    question: 'Quanto dá R$ 350,00 por mês projetado em 12 meses?',
    calls: [{ name: 'calculate', args: { op: 'project', values: [35_000], months: 12 } }],
    figures: async () => [brl(compareValues({ op: 'project', valuesCents: [35_000], months: 12 }).value)],
    answer: ([val]) => `Em 12 meses, o valor projetado é ${val}.`,
  },
  {
    id: 'numeric.op.pct_of',
    category: 'numeric',
    question: 'Quantos por cento R$ 500,00 representa de R$ 2.000,00?',
    calls: [{ name: 'calculate', args: { op: 'pct_of', values: [50_000, 200_000] } }],
    figures: async () => ['25%'],
    answer: ([pct]) => `R$ 500,00 corresponde a ${pct} de R$ 2.000,00.`,
  },
  {
    id: 'numeric.op.pct_change.alta',
    category: 'numeric',
    question: 'Qual a variação percentual de R$ 1.000,00 para R$ 1.250,00?',
    calls: [{ name: 'calculate', args: { op: 'pct_change', values: [100_000, 125_000] } }],
    figures: async () => ['25%'],
    answer: ([pct]) => `A variação de R$ 1.000,00 para R$ 1.250,00 é de ${pct}.`,
  },
  {
    id: 'numeric.op.pct_change.queda',
    category: 'numeric',
    question: 'Qual a variação percentual de R$ 2.000,00 para R$ 1.600,00?',
    calls: [{ name: 'calculate', args: { op: 'pct_change', values: [200_000, 160_000] } }],
    figures: async () => ['-20%'],
    answer: ([pct]) => `A variação de R$ 2.000,00 para R$ 1.600,00 é de ${pct}.`,
  },
];

/** 30 cenarios numericos com gabarito exato (spec 037, US5, T042: 5 + 3 + 14 + 8 = 30). */
export const NUMERIC_SCENARIOS: readonly EvalScenario[] = [
  ...compareScenarios,
  ...compareAccountScenarios,
  ...exprScenarios,
  ...NAMED_OPS,
];
