import { DomainError } from '../shared/domain.error.ts';

/**
 * Lancado quando o usuario tenta criar ou renomear uma categoria para um nome normalizado
 * que ele ja tem (spec 003, CA-2). Ao *lancar* um gasto o nome digitado reusa a categoria
 * existente em vez de dar erro (CA-10) - este erro e so do CRUD de categorias.
 */
export class DuplicateCategoryError extends DomainError {
  public constructor(name: string) {
    super('DUPLICATE_CATEGORY', `categoria ja existe: ${name}`);
  }
}
