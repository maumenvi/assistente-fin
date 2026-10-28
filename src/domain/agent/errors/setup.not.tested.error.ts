import { type ConnectionReport } from '../connection/connection.report.ts';
import { AgentError } from './agent.error.ts';

/** Tentativa de salvar uma configuracao cujo teste nao passou (ou com avisos nao confirmados). Leva o relatorio para a tela. */
export class SetupNotTestedError extends AgentError {
  public readonly report: ConnectionReport;

  public constructor(report: ConnectionReport) {
    super('SETUP_NOT_TESTED', 'a configuracao nao passou no teste de conexao');
    this.report = report;
  }
}
