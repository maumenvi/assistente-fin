import { type AgentOp } from '../format/agent.op.ts';

/**
 * Os dados mudaram desde a copia em que o agente se baseou? (spec 029, FR-018, R5). Com `expectV` compara
 * a versao que o agente viu com a atual; sem ele, usa o instante da copia (`snapshot.at`) lembrado pelo
 * app: stale se a entidade foi alterada depois dele. Sem nenhuma das duas referencias, nao ha como saber.
 */
export function isStale(op: AgentOp, currentVersion: string | null, snapshotAt: string | null): boolean {
  if (currentVersion === null) return false;
  const current = new Date(currentVersion).getTime();
  if (op.expectV !== undefined) return new Date(op.expectV).getTime() !== current;
  if (snapshotAt !== null) return current > new Date(snapshotAt).getTime();
  return false;
}
