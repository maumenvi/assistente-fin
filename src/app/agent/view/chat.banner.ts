/** Faixa de aviso do topo do chat (estados M9/D7: sem modelo, sem rede, consentimento, provedor fora, modo local). */
export interface ChatBanner {
  readonly kind: 'no_model' | 'offline' | 'consent_required' | 'provider_down' | 'local_only' | 'send_error';
  readonly text: string;
}
