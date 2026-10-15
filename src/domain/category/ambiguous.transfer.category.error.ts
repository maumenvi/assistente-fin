import { DomainError } from '../shared/domain.error.ts';

/** Uma candidata a categoria de transferencia encontrada por nome (spec 016, RF-10). */
export interface AmbiguousTransferCategoryCandidate {
  readonly categoryId: string;
  readonly name: string;
  /** Quantos lancamentos ja apontam para esta categoria - ajuda a decisao manual. */
  readonly transactionCount: number;
}

/**
 * Lancado pela migracao idempotente da categoria de transferencia (spec 016, RF-10) quando
 * o usuario tem 2 ou mais categorias cujo nome normalizado bate com `TRANSFER_CATEGORY_NAME`.
 * A migracao nunca escolhe nem mescla candidatas automaticamente - exige resolucao manual
 * antes de repetir a operacao. `candidates` carrega o diagnostico completo (id, nome,
 * contagem de lancamentos) para quem for decidir manualmente.
 */
export class AmbiguousTransferCategoryError extends DomainError {
  public readonly candidates: readonly AmbiguousTransferCategoryCandidate[];

  public constructor(candidates: readonly AmbiguousTransferCategoryCandidate[]) {
    super(
      'AMBIGUOUS_TRANSFER_CATEGORY',
      'existe mais de uma categoria candidata a transferencia - resolva manualmente antes de migrar',
    );
    this.candidates = candidates;
  }
}
