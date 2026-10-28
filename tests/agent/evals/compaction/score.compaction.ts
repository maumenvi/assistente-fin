import { hasMoneyFigure } from '../../../../src/domain/agent/summary/has.money.figure.ts';
import { type CompactionScenario } from './compaction.scenario.ts';
import { type CompactionRun } from './run.compaction.scenario.ts';

const norm = (text: string): string => text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

/** Pontuacao de um cenario de compactacao. */
export interface CompactionScore {
  readonly id: string;
  readonly facts: number;
  /** Fatos cujas pistas estao todas no contexto depois de compactar (a pergunta de controle e respondivel). */
  readonly answerable: number;
  readonly missing: readonly string[];
  /** O valor plantado ainda aparece como numero no contexto (deveria ser reconsultado). */
  readonly valueLeak: boolean;
  readonly moneyInSummary: boolean;
  readonly historyIntact: boolean;
  readonly prefixStable: boolean;
  readonly compacted: boolean;
  readonly passed: boolean;
}

/** Limiares de aceitacao da fidelidade (SC-005). */
export const COMPACTION_THRESHOLDS = Object.freeze({ minFidelity: 0.95, maxValueLeaks: 0 });

/** Pontua um cenario: fatos respondiveis, valor nao repetido, resumo sem dinheiro, historico integro e prefixo estavel. */
export function scoreCompaction(scenario: CompactionScenario, run: CompactionRun): CompactionScore {
  const context = norm(run.context);
  const missing = scenario.facts.filter((f) => !f.probes.every((p) => context.includes(norm(p)))).map((f) => f.id);
  const valueLeak = context.includes(norm(scenario.planted.figure));
  const moneyInSummary = hasMoneyFigure(run.summaryText);
  const historyIntact = run.storedMessages === run.totalMessages;
  const compacted = run.compactions >= 3;
  return {
    id: scenario.id,
    facts: scenario.facts.length,
    answerable: scenario.facts.length - missing.length,
    missing,
    valueLeak,
    moneyInSummary,
    historyIntact,
    prefixStable: run.prefixStable,
    compacted,
    passed: missing.length === 0 && !valueLeak && !moneyInSummary && historyIntact && run.prefixStable && compacted,
  };
}
