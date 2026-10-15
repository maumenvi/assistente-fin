/** Ainda ha alteracoes do celular que o desktop nao recebeu (spec 022, FR-008a). */
export class UnpairPendingError extends Error {
  public readonly code = 'UNPAIR_PENDING';
  public readonly pending: number;

  public constructor(pending: number) {
    super(`${String(pending)} alteracao(oes) ainda nao chegaram ao desktop; sincronize antes ou confirme o despareamento (elas continuam no celular)`);
    this.name = 'UnpairPendingError';
    this.pending = pending;
  }
}
