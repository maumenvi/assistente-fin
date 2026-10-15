/**
 * Falha de escrita concorrente na fronteira da aplicacao (spec 002, RF-31).
 *
 * Lancada por um repositorio quando o registro foi alterado por outra interface entre a
 * leitura e o `save`: o `updatedAt` que a entidade carrega (a versao lida) nao bate mais com
 * o que esta no banco. Nada e gravado. A borda pede ao usuario recarregar antes de tentar de
 * novo. Nao e um `DomainError` (nao e regra de negocio) - e o mesmo espirito de
 * `InvalidInputError`: uma falha previsivel da fronteira que a UI traduz.
 */
export class StaleDataError extends Error {
  public readonly code = 'STALE_DATA';

  public constructor(entity: string) {
    super(`registro de ${entity} foi alterado por outra sessao - recarregue e tente de novo`);
    this.name = 'StaleDataError';
  }
}
