/** O conflito ja foi resolvido (ou nunca existiu) (spec 022, T121). */
export class SyncConflictNotFoundError extends Error {
  public readonly code = 'SYNC_CONFLICT_NOT_FOUND';

  public constructor() {
    super('conflito nao encontrado - talvez ja tenha sido resolvido');
    this.name = 'SyncConflictNotFoundError';
  }
}
