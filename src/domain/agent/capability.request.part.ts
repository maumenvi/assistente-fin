/**
 * Cartao de pedido de capacidade na conversa (spec 034): so guarda o id; o cartao busca o pedido
 * (candidato, estado, prazo) por `ListCapabilities`/`GetCapabilityRequest`, entao o estado nunca fica velho
 * dentro da mensagem.
 */
export interface CapabilityRequestPart {
  readonly type: 'capability_request';
  readonly requestId: string;
}
