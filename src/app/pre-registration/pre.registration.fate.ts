/**
 * Destino de um pre-registro consultado pela tela (spec 027, R6): ainda pendente, aprovado (com o
 * lancamento), descartado, ou desconhecido (sem registro - nao afirmar o que aconteceu).
 */
export type PreRegistrationFate =
  | { readonly outcome: 'pending' }
  | { readonly outcome: 'approved'; readonly transactionId: string | null }
  | { readonly outcome: 'discarded' }
  | { readonly outcome: 'unknown' };
