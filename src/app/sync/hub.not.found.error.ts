/**
 * Nenhum endereco (conhecido, varrido na rede ou digitado) respondeu como o desktop pareado
 * (spec 024, FR-008). As alteracoes pendentes continuam guardadas.
 */
export class HubNotFoundError extends Error {
  public readonly code = 'HUB_NOT_FOUND';

  public constructor() {
    super('desktop pareado nao encontrado na rede');
    this.name = 'HubNotFoundError';
  }
}
