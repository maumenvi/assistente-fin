import { DomainError } from '../shared/domain.error.ts';

/**
 * Lancado ao calcular fatura/limite disponivel de uma conta `credit-card` sem
 * `creditLimit`/`dueDay` configurados (spec 008, decisao 4.4 do plano - proposta adotada:
 * fora de escopo da spec migrar contas existentes automaticamente; o usuario completa o
 * cadastro via `changeCreditCardTerms`).
 */
export class CreditCardTermsNotConfiguredError extends DomainError {
  public constructor() {
    super(
      'CREDIT_CARD_TERMS_NOT_CONFIGURED',
      'conta de cartao de credito sem limite/vencimento configurados',
    );
  }
}
