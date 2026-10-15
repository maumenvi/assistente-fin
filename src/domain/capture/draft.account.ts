/**
 * Conta da notificacao: `id` resolvido (ou `null`) e se a notificacao CITOU algum cartao
 * (`hinted`). Citou e nao casou com nenhuma conta = cartao diferente do do candidato.
 */
export interface DraftAccount {
  readonly id: string | null;
  readonly hinted: boolean;
}
