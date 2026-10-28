import { buildSyntheticDatabase } from '../dataset/build.synthetic.database.ts';
import { runWriteScenario, type ProposeTransform } from './run.write.scenario.ts';
import { scoreWrite, WRITE_THRESHOLDS, type WriteScore } from './score.write.ts';
import { WRITE_EVAL_SCENARIOS } from './write.scenarios.ts';
import { type WriteScenario } from './write.scenario.ts';

/** Relatorio agregado da avaliacao de escrita segura. */
export interface WriteReport {
  readonly suite: 'write';
  readonly total: number;
  readonly accepted: number;
  readonly acceptedRate: number;
  readonly wrongValues: number;
  readonly unapprovedWrites: number;
  readonly violations: readonly string[];
  readonly failures: readonly WriteScore[];
  readonly ok: boolean;
}

/** Roda os cenarios e confere os limiares da SC-003: >= 95% sem edicao, 0 valores trocados, 0 escritas sem aprovacao. */
export async function runWriteSuite(options: { readonly transform?: ProposeTransform; readonly scenarios?: readonly WriteScenario[] } = {}): Promise<{ readonly report: WriteReport; readonly scores: readonly WriteScore[] }> {
  const scores: WriteScore[] = [];
  for (const scenario of options.scenarios ?? WRITE_EVAL_SCENARIOS) {
    const ds = await buildSyntheticDatabase();
    try {
      const run = await runWriteScenario(ds, scenario, options.transform === undefined ? {} : { transform: options.transform });
      scores.push(scoreWrite(scenario.id, await scenario.expect(ds), run));
    } catch (error) {
      scores.push({ id: scenario.id, acceptedWithoutEdit: false, wrongValues: 0, unapprovedWrite: false, reasons: [error instanceof Error ? error.message : String(error)] });
    }
  }
  const accepted = scores.filter((s) => s.acceptedWithoutEdit).length;
  const acceptedRate = scores.length === 0 ? 0 : accepted / scores.length;
  const wrongValues = scores.reduce((sum, s) => sum + s.wrongValues, 0);
  const unapprovedWrites = scores.filter((s) => s.unapprovedWrite).length;
  const violations: string[] = [];
  if (acceptedRate < WRITE_THRESHOLDS.minAcceptedWithoutEdit) violations.push(`aprovados sem edição ${(acceptedRate * 100).toFixed(1)}% (mínimo ${WRITE_THRESHOLDS.minAcceptedWithoutEdit * 100}%)`);
  if (wrongValues > WRITE_THRESHOLDS.maxWrongValues) violations.push(`${String(wrongValues)} valor(es) diferente(s) do pedido (limite ${String(WRITE_THRESHOLDS.maxWrongValues)})`);
  if (unapprovedWrites > WRITE_THRESHOLDS.maxUnapprovedWrites) violations.push(`${String(unapprovedWrites)} cenário(s) gravaram sem aprovação (limite ${String(WRITE_THRESHOLDS.maxUnapprovedWrites)})`);
  const failures = scores.filter((s) => !s.acceptedWithoutEdit);
  return { report: { suite: 'write', total: scores.length, accepted, acceptedRate, wrongValues, unapprovedWrites, violations, failures, ok: violations.length === 0 }, scores };
}

/** Relatorio em Markdown (vai para `tests/agent/evals/report/write.md`). */
export function renderWriteReport(report: WriteReport): string {
  const lines = [
    '# Avaliação do agente — escrita segura',
    '',
    `Resultado: **${report.ok ? 'aprovado' : 'reprovado'}** — ${String(report.accepted)}/${String(report.total)} planos aprovados sem edição (${(report.acceptedRate * 100).toFixed(1)}%), ${String(report.wrongValues)} valores diferentes do pedido, ${String(report.unapprovedWrites)} gravações sem aprovação.`,
  ];
  if (report.violations.length > 0) lines.push('', '## Limiares violados', ...report.violations.map((v) => `- ${v}`));
  if (report.failures.length > 0) lines.push('', '## Cenários com problema', ...report.failures.map((f) => `- **${f.id}**: ${f.reasons.join('; ')}`));
  return `${lines.join('\n')}\n`;
}
