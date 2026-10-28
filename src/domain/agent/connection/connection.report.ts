import { type ModelCapabilities } from '../model.capabilities.ts';
import { type ConnectionStep } from './connection.step.ts';
import { type DetectedInfo } from './detected.info.ts';

/** Relatorio do teste de conexao (spec 035, contracts/connection.report.md). Nunca carrega a chave. */
export interface ConnectionReport {
  /** Nenhuma etapa `failed`. */
  readonly ok: boolean;
  /** `ok` e (sem `warn` ou o usuario confirma na hora de salvar). */
  readonly canSave: boolean;
  /** Sempre as 5 etapas, na ordem. */
  readonly steps: readonly ConnectionStep[];
  /** O modelo realmente sondado (padrao ou o informado). */
  readonly model: string | null;
  readonly capabilities: ModelCapabilities | null;
  readonly detected: DetectedInfo;
}
