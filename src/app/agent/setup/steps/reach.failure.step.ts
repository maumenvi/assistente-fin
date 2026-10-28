import { type ConnectionStep } from '../../../../domain/agent/connection/connection.step.ts';

/** Falha ao alcancar o servidor: Ollama desligado, tempo esgotado ou sem conexao (nunca culpa da chave). */
export function reachFailureStep(error: unknown, local: boolean): ConnectionStep {
  const text = error instanceof Error ? `${error.message} ${(error.cause as { message?: string } | undefined)?.message ?? ''}` : '';
  if (/timeout|timed out|aborted/i.test(text)) return { id: 'reach', status: 'failed', code: 'reach.timeout' };
  return { id: 'reach', status: 'failed', code: local ? 'reach.local_down' : 'reach.offline' };
}
