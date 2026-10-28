import { type LlmPort } from '../../../../src/app/agent/ports/llm/llm.port.ts';
import { COMPACTION_SCENARIOS } from './compaction.scenarios.ts';
import { type CompactionScenario } from './compaction.scenario.ts';
import { oracleSummarizer } from './oracle.summarizer.ts';
import { runCompactionScenario } from './run.compaction.scenario.ts';
import { COMPACTION_THRESHOLDS, scoreCompaction, type CompactionScore } from './score.compaction.ts';

/** Relatorio agregado da avaliacao de fidelidade da compactacao. */
export interface CompactionReport {
  readonly suite: 'compaction';
  readonly total: number;
  readonly passed: number;
  /** Fatos respondiveis depois de compactar / fatos plantados. */
  readonly fidelity: number;
  readonly valueLeaks: number;
  readonly violations: readonly string[];
  readonly failures: readonly CompactionScore[];
  readonly ok: boolean;
}

/** Roda os cenarios e confere os limiares (>= 95% de fidelidade e 0 valores repetidos da memoria). */
export async function runCompactionSuite(options: { readonly summarizerFor?: (scenario: CompactionScenario) => LlmPort; readonly scenarios?: readonly CompactionScenario[] } = {}): Promise<{ readonly report: CompactionReport; readonly scores: readonly CompactionScore[] }> {
  const scenarios = options.scenarios ?? COMPACTION_SCENARIOS;
  const scores: CompactionScore[] = [];
  for (const scenario of scenarios) {
    const summarizer = (options.summarizerFor ?? oracleSummarizer)(scenario);
    scores.push(scoreCompaction(scenario, await runCompactionScenario(scenario, summarizer)));
  }
  const facts = scores.reduce((sum, s) => sum + s.facts, 0);
  const answerable = scores.reduce((sum, s) => sum + s.answerable, 0);
  const fidelity = facts === 0 ? 0 : answerable / facts;
  const valueLeaks = scores.filter((s) => s.valueLeak || s.moneyInSummary).length;
  const violations: string[] = [];
  if (fidelity < COMPACTION_THRESHOLDS.minFidelity) violations.push(`fidelidade ${(fidelity * 100).toFixed(1)}% (minimo ${COMPACTION_THRESHOLDS.minFidelity * 100}%)`);
  if (valueLeaks > COMPACTION_THRESHOLDS.maxValueLeaks) violations.push(`${String(valueLeaks)} cenario(s) repetem valor da memoria (limite ${String(COMPACTION_THRESHOLDS.maxValueLeaks)})`);
  const failures = scores.filter((s) => !s.passed);
  if (failures.some((s) => !s.historyIntact)) violations.push('historico alterado pela compactacao');
  if (failures.some((s) => !s.prefixStable)) violations.push('prefixo do contexto instavel');
  if (failures.some((s) => !s.compacted)) violations.push('conversa nao estourou a janela as vezes previstas');
  return { report: { suite: 'compaction', total: scores.length, passed: scores.length - failures.length, fidelity, valueLeaks, violations, failures, ok: violations.length === 0 }, scores };
}

/** Relatorio em Markdown (vai para `tests/agent/evals/report/compaction.md`). */
export function renderCompactionReport(report: CompactionReport): string {
  const lines = [
    '# Avaliação do agente — compactação',
    '',
    `Cenários aprovados: ${String(report.passed)}/${String(report.total)}`,
    `Fidelidade (fatos respondíveis após compactar): ${(report.fidelity * 100).toFixed(1)}%`,
    `Cenários com valor repetido da memória: ${String(report.valueLeaks)}`,
    '',
    report.ok ? 'Resultado: **aprovado**' : 'Resultado: **reprovado**',
  ];
  if (report.violations.length > 0) lines.push('', '## Limiares violados', ...report.violations.map((v) => `- ${v}`));
  if (report.failures.length > 0) lines.push('', '## Falhas', ...report.failures.map((f) => `- \`${f.id}\`: faltam ${f.missing.join(', ') || '—'}${f.valueLeak ? '; valor repetido' : ''}${f.moneyInSummary ? '; dinheiro no resumo' : ''}`));
  return `${lines.join('\n')}\n`;
}
