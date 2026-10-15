import { DomainError } from '../shared/domain.error.ts';

/**
 * Lancado quando a categoria nao existe, ou existe mas pertence a outro usuario
 * (spec 003, CA-30) - as duas situacoes devolvem o mesmo erro para nao vazar a existencia
 * de dados alheios.
 */
export class CategoryNotFoundError extends DomainError {
  public constructor() {
    super('CATEGORY_NOT_FOUND', 'categoria nao encontrada');
  }
}
