import { DomainError } from '../shared/domain.error.ts';

/** Lancado quando os dados de uma categoria violam uma invariante do dominio (spec 003, RF-9). */
export class InvalidCategoryError extends DomainError {
  public constructor(reason: string) {
    super('INVALID_CATEGORY', `categoria invalida: ${reason}`);
  }
}
