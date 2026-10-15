import { DomainError } from './domain.error.ts';

/**
 * Lancado quando uma `Recurrence` viola uma invariante: frequencia desconhecida, `everyN`
 * < 1, ou data final incompativel com a frequencia (ausente quando repete, presente em
 * "nao-repete").
 */
export class InvalidRecurrenceError extends DomainError {
  public constructor(reason: string) {
    super('INVALID_RECURRENCE', `recorrencia invalida: ${reason}`);
  }
}
