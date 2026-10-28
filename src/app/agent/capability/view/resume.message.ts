import { sanitizeText } from '../../tools/shared/sanitize.text.ts';

/**
 * Mensagem que a UI manda ao assistente depois da decisao do usuario (spec 034): o agente nao e avisado por
 * canal nenhum, so por uma mensagem comum do usuario, que o faz continuar (ou responder sem a capacidade).
 */
export function resumeMessage(decision: 'approved' | 'rejected', capabilityName: string): string {
  const name = sanitizeText(capabilityName, 60);
  return decision === 'approved' ? `Aprovei a capacidade "${name}". Continue o pedido anterior.` : `Recusei a capacidade "${name}". Responda sem ela.`;
}
