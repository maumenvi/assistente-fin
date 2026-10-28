import { AgentError } from './agent.error.ts';

/** O relatorio traz numeros que nenhuma consulta desta execucao produziu (spec 040, FR-017). */
export class ReportDataMismatchError extends AgentError {
  public readonly values: readonly string[];

  public constructor(values: readonly string[]) {
    super('REPORT_DATA_MISMATCH', `o relatorio tem valores que nao vieram das consultas: ${values.slice(0, 5).join(', ')}`);
    this.values = values;
  }
}
