/** Textos fixos do agente (sem LLM): pedido de escrita, fora de escopo e mudanca de configuracoes. */
export interface CannedReplies {
  writeRequest(): string;
  outOfScope(): string;
  settingsRequest(): string;
  settingsButtonLabel(): string;
}
