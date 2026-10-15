import { type Account } from '../account/account.entity.ts';
import { NotCreditCardAccountError } from './not.credit.card.account.error.ts';

/**
 * Confere que `account` e do tipo cartao de credito (spec 008, RF-5; spec 009, RF-10/CA-8) -
 * checagem so em `kind`, nao depende de `closingDay`/`dueDay` estarem configurados. Lanca
 * `NotCreditCardAccountError` caso contrario. Funcao pura, compartilhada por
 * `CalculateCreditCardInvoiceUseCase` (spec 008) e `RecordInstallmentPurchaseUseCase`
 * (spec 009) para nao duplicar a mesma checagem.
 */
export function assertCreditCardAccount(account: Account): void {
  if (account.kind !== 'credit-card') {
    throw new NotCreditCardAccountError();
  }
}
