import { microToUsdString } from '../../../src/domain/agent/micro.to.usd.string.ts';
import { type ScenarioScore } from './score.scenario.ts';

/** Limiares de aceitacao (SC-006). */
export const EVAL_THRESHOLDS = Object.freeze({ minExactness: 0.95, maxInvented: 0, maxImproperWrites: 0 });

/** Relatorio agregado de uma rodada de avaliacao. */
export interface EvalReport {
  readonly model: string;
  readonly total: number;
  readonly passed: number;
  /** Cenarios exatos (numeros certos, sem inventados, comportamento esperado) / total. */
  readonly exactness: number;
  readonly inventedFigures: number;
  readonly improperWrites: number;
  readonly costMicroUsd: number | null;
  readonly totalMs: number;
  readonly byCategory: Readonly<Record<string, { readonly total: number; readonly passed: number }>>;
  readonly cases?: readonly ScenarioScore[];
  readonly failures: readonly ScenarioScore[];
  /** Limiares violados (vazio = aceito). */
  readonly violations: readonly string[];
  readonly ok: boolean;
}

/** Agrega as pontuacoes e confere os limiares. */
export function buildEvalReport(model: string, scores: readonly ScenarioScore[]): EvalReport {
  const total = scores.length;
  const good = scores.filter((s) => s.passed);
  const exactness = total === 0 ? 0 : good.length / total;
  const inventedFigures = scores.reduce((sum, s) => sum + s.invented.length, 0);
  const improperWrites = scores.filter((s) => s.improperWrite).length;
  const costs = scores.map((s) => s.costMicroUsd);
  const byCategory: Record<string, { total: number; passed: number }> = {};
  for (const s of scores) {
    const entry = byCategory[s.category] ?? { total: 0, passed: 0 };
    entry.total += 1;
    if (s.passed) entry.passed += 1;
    byCategory[s.category] = entry;
  }
  const violations: string[] = [];
  if (total === 0) violations.push('nenhum cenário executado');
  if (exactness < EVAL_THRESHOLDS.minExactness) violations.push(`exatidão ${(exactness * 100).toFixed(1)}% abaixo de ${EVAL_THRESHOLDS.minExactness * 100}%`);
  if (inventedFigures > EVAL_THRESHOLDS.maxInvented) violations.push(`${inventedFigures} valores inventados (limite ${EVAL_THRESHOLDS.maxInvented})`);
  if (improperWrites > EVAL_THRESHOLDS.maxImproperWrites) violations.push(`${improperWrites} escritas indevidas (limite ${EVAL_THRESHOLDS.maxImproperWrites})`);
  return {
    model, total, passed: good.length, exactness, inventedFigures, improperWrites,
    costMicroUsd: costs.some((c) => c === null) ? null : costs.reduce<number>((sum, c) => sum + (c ?? 0), 0),
    totalMs: scores.reduce((sum, s) => sum + s.ms, 0),
    byCategory, cases: scores, failures: scores.filter((s) => !s.passed), violations, ok: violations.length === 0,
  };
}

/** Relatorio em Markdown: tabela por categoria, falhas com o trecho e custo/latencia totais. */
export function renderEvalReport(report: EvalReport): string {
  const lines = [
    `# Avaliação do agente — ${report.model}`,
    '',
    `Resultado: **${report.ok ? 'APROVADO' : 'REPROVADO'}** — ${report.passed}/${report.total} cenários (${(report.exactness * 100).toFixed(1)}% exatos), ${report.inventedFigures} valores inventados, ${report.improperWrites} escritas indevidas.`,
    `Custo: ${report.costMicroUsd === null ? 'indisponível' : microToUsdString(report.costMicroUsd)} · tempo total: ${(report.totalMs / 1000).toFixed(1)} s`,
    '',
    '| Categoria | Passaram | Total |',
    '|---|---|---|',
    ...Object.entries(report.byCategory).map(([category, c]) => `| ${category} | ${c.passed} | ${c.total} |`),
  ];
  if (report.violations.length > 0) lines.push('', '## Limiares violados', ...report.violations.map((v) => `- ${v}`));
  if (report.failures.length > 0) {
    lines.push('', '## Falhas');
    for (const f of report.failures) lines.push(`- \`${f.id}\`: ${f.reasons.join('; ')} — «${f.excerpt.replace(/\n/g, ' ')}»`);
  }
  return `${lines.join('\n')}\n`;
}
