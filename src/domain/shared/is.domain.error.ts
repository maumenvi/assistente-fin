import { DomainError } from './domain.error.ts';

/**
 * Type guard para `DomainError`.
 *
 * Usado na borda para separar falhas de negocio previsiveis (traduzir em resposta) de
 * erros inesperados (logar e devolver 500/erro generico).
 */
export function isDomainError(value: unknown): value is DomainError {
  return value instanceof DomainError;
}
