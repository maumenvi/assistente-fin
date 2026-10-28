import { type AgentRun } from './agent.run.ts';

/**
 * Verifica se uma execucao pode ser retomada de onde parou pelo botao "Continuar" (spec 038, FR-009):
 * execucoes pausadas por limite de passos/tokens/orcamento (`BUDGET_EXCEEDED`, `LIMIT_STEPS`, `LIMIT_TOKENS`)
 * ou interrompidas/paradas pela pessoa com estado salvo no checkpoint.
 */
export function canContinueRun(
  run: Pick<AgentRun, 'status' | 'errorCode' | 'state' | 'currentNode'> | null | undefined,
): boolean {
  if (run === null || run === undefined) return false;
  if (run.status === 'running') return false;
  if (
    run.errorCode === 'BUDGET_EXCEEDED' ||
    run.errorCode === 'LIMIT_STEPS' ||
    run.errorCode === 'LIMIT_TOKENS'
  ) {
    return run.state !== null && run.state !== undefined;
  }
  // parada pela pessoa (`cancelled`) ou interrompida (app fechado, queda): retoma do ultimo checkpoint
  if (run.status === 'interrupted' || run.status === 'cancelled') {
    return (run.state !== null && run.state !== undefined) || run.currentNode !== null;
  }
  return false;
}

