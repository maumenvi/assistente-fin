/**
 * Cartao do plano na conversa (spec 033): so guarda o id; o cartao busca o plano (itens, estado,
 * prazo do desfazer) por `GetPlan`, entao o estado nunca fica velho dentro da mensagem.
 */
export interface PlanPart {
  readonly type: 'plan';
  readonly planId: string;
}
