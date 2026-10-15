import { DomainError } from './domain.error.ts';

/**
 * Lancado quando se tenta criar `Money` com um valor invalido:
 * nao finito ou com fracao de centavo (o dominio so opera em centavos inteiros).
 */
export class InvalidMoneyAmountError extends DomainError {
  public constructor(received: number) {
    super('INVALID_MONEY_AMOUNT', `valor monetario invalido em centavos: ${received}`);
  }
}
