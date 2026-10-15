import { DomainError } from '../shared/domain.error.ts';

/** Lancado ao restaurar/exportar/excluir um snapshot que nao existe no escopo do usuario. */
export class DataSnapshotNotFoundError extends DomainError {
  public constructor() {
    super('DATA_SNAPSHOT_NOT_FOUND', 'snapshot nao encontrado');
  }
}
