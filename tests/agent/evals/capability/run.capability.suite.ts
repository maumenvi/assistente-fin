import { buildSyntheticDatabase } from '../dataset/build.synthetic.database.ts';
import { CAPABILITY_SCENARIOS } from './capability.scenarios.ts';
import { type CapabilityScenario } from './capability.scenario.ts';
import { runCapabilityScenario, type RunOptions } from './run.capability.scenario.ts';
import { CAPABILITY_THRESHOLDS, scoreCapability, type CapabilityScore } from './score.capability.ts';

/** Relatorio agregado da avaliacao de capacidades. */
export interface CapabilityReport {
  readonly suite: 'capability';
  readonly total: number;
  readonly rightCards: number;
  readonly rightCardRate: number;
  readonly connectedWithoutApproval: number;
  readonly fabricatedCandidates: number;
  readonly violations: readonly string[];
  readonly failures: readonly CapabilityScore[];
  readonly ok: boolean;
}

/** Roda os cenarios e confere os limiares da SC-006. */
export async function runCapabilitySuite(options: RunOptions & { readonly scenarios?: readonly CapabilityScenario[] } = {}): Promise<{ readonly report: CapabilityReport; readonly scores: readonly CapabilityScore[] }> {
  const scores: CapabilityScore[] = [];
  for (const scenario of options.scenarios ?? CAPABILITY_SCENARIOS) {
    const ds = await buildSyntheticDatabase();
    try {
      scores.push(scoreCapability(scenario, await runCapabilityScenario(ds, scenario, options)));
    } catch (error) {
      scores.push({ id: scenario.id, rightCard: false, connectedWithoutApproval: false, fabricated: 0, passed: false, reasons: [error instanceof Error ? error.message : String(error)] });
    }
  }
  const rightCards = scores.filter((s) => s.rightCard).length;
  const rightCardRate = scores.length === 0 ? 0 : rightCards / scores.length;
  const connectedWithoutApproval = scores.filter((s) => s.connectedWithoutApproval).length;
  const fabricatedCandidates = scores.reduce((sum, s) => sum + s.fabricated, 0);
  const violations: string[] = [];
  if (rightCardRate < CAPABILITY_THRESHOLDS.minRightCardRate) violations.push(`cartao certo em ${(rightCardRate * 100).toFixed(1)}% dos cenarios (minimo ${CAPABILITY_THRESHOLDS.minRightCardRate * 100}%)`);
  if (connectedWithoutApproval > CAPABILITY_THRESHOLDS.maxConnectedWithoutApproval) violations.push(`${String(connectedWithoutApproval)} cenario(s) conectaram sem aprovacao (limite 0)`);
  if (fabricatedCandidates > CAPABILITY_THRESHOLDS.maxFabricated) violations.push(`${String(fabricatedCandidates)} candidato(s) fabricado(s) (limite 0)`);
  const failures = scores.filter((s) => !s.passed);
  if (failures.some((s) => s.reasons.includes('gravou dados'))) violations.push('gravacao de dados durante a busca de capacidade');
  return { report: { suite: 'capability', total: scores.length, rightCards, rightCardRate, connectedWithoutApproval, fabricatedCandidates, violations, failures, ok: violations.length === 0 && failures.length === 0 }, scores };
}

/** Relatorio em Markdown (vai para `tests/agent/evals/report/capability.md`). */
export function renderCapabilityReport(report: CapabilityReport): string {
  const lines = [
    '# Avaliação do agente — capacidades',
    '',
    `Cartão certo: ${String(report.rightCards)}/${String(report.total)} (${(report.rightCardRate * 100).toFixed(1)}%)`,
    `Conexões sem aprovação: ${String(report.connectedWithoutApproval)} · candidatos fabricados: ${String(report.fabricatedCandidates)}`,
    '',
    report.ok ? 'Resultado: **aprovado**' : 'Resultado: **reprovado**',
  ];
  if (report.violations.length > 0) lines.push('', '## Limiares violados', ...report.violations.map((v) => `- ${v}`));
  if (report.failures.length > 0) lines.push('', '## Falhas', ...report.failures.map((f) => `- \`${f.id}\`: ${f.reasons.join('; ')}`));
  return `${lines.join('\n')}\n`;
}
