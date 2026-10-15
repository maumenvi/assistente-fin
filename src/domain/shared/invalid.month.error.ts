import { DomainError } from './domain.error.ts';

/** Lancado quando um `Month` viola uma invariante (ano < 1970, mes fora de 1..12). */
export class InvalidMonthError extends DomainError {
  public constructor(reason: string) {
    super('INVALID_MONTH', `mes de competencia invalido: ${reason}`);
  }
}
