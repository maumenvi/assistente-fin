import { DomainError } from '../shared/domain.error.ts';

/** A importacao tem conflito sem decisao - nada foi gravado (spec 022, FR-018/FR-019). */
export class UnresolvedImportConflictError extends DomainError {
  public readonly conflictIds: readonly string[];

  public constructor(conflictIds: readonly string[]) {
    super('UNRESOLVED_IMPORT_CONFLICT', `${String(conflictIds.length)} conflito(s) sem decisao`);
    this.conflictIds = conflictIds;
  }
}
