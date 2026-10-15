import { type ScenarioApplication } from '../../domain/scenario/scenario.application.entity.ts';

/** Resultado de `ApplyScenarioUseCase`. */
export interface ApplyScenarioResult {
  /** O "recibo" gravado - identifica a aplicacao ativa (RF-40). */
  readonly application: ScenarioApplication;
  /** Id do snapshot gravado antes de materializar (RF-37). */
  readonly snapshotId: string;
  /** Quantos lancamentos (ganhos de ajuste) foram criados. */
  readonly createdIncomeCount: number;
  /** Meses `AAAA-MM` cujo efeito liquido era uma reducao - nao materializados (RF-37a). */
  readonly skippedMonths: readonly string[];
}
