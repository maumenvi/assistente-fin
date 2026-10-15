import { DomainError } from './domain.error.ts';

/**
 * Lancado ao operar (`add`, `subtract`, `compare`) entre valores de moedas diferentes.
 * O dominio nao converte cambio: isso e responsabilidade de outra camada.
 */
export class CurrencyMismatchError extends DomainError {
  public constructor(left: string, right: string) {
    super('CURRENCY_MISMATCH', `operacao entre moedas diferentes: ${left} e ${right}`);
  }
}
