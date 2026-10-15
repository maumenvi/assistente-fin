import { DomainError } from '../shared/domain.error.ts';

/** Lancado quando os dados de um snapshot (ponto de restauracao) violam uma invariante. */
export class InvalidDataSnapshotError extends DomainError {
  public constructor(reason: string) {
    super('INVALID_DATA_SNAPSHOT', `snapshot invalido: ${reason}`);
  }
}
