/** Pedido pronto que o usuario escolhe na tela de compartilhar (spec 029, FR-017). */
export interface AgentRequest {
  readonly id: 'monthly-review' | 'categorize-statement' | 'plan-purchase' | 'log-expenses';
  readonly title: string;
  /** Texto que entra no bloco "[Pedido]" do conteudo copiado e dos arquivos. */
  readonly text: string;
  /** Dica curta para o usuario: o que fazer depois de enviar (ex.: colar o extrato). */
  readonly hint: string;
}
