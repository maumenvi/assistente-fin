import { type ConnectionStepId } from './connection.step.id.ts';
import { type ConnectionStepStatus } from './connection.step.status.ts';

/** Resultado de uma etapa; `detail` so traz numeros e ids de modelo, nunca a chave. */
export interface ConnectionStep {
  readonly id: ConnectionStepId;
  readonly status: ConnectionStepStatus;
  /** Codigo estavel (`key.invalid`, `tools.unsupported`...), traduzido em texto por `describeConnectionReport`. */
  readonly code: string;
  readonly detail?: Readonly<Record<string, string | number>>;
}
