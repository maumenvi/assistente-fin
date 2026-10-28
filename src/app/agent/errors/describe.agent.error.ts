import { AGENT_ERROR_MESSAGES } from './agent.error.messages.ts';

/** Texto de um erro do agente para o usuario; codigo desconhecido cai numa mensagem generica (nunca vaza detalhe interno). */
export function describeAgentError(code: string | null | undefined): string {
  if (code === null || code === undefined) return 'Algo deu errado. Tente novamente.';
  return AGENT_ERROR_MESSAGES[code] ?? 'Algo deu errado ao responder. Tente novamente.';
}
