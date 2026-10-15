/**
 * Um endereco com o `hubId` certo recusou o aparelho (401) SEM ter provado a identidade (spec
 * 024, FR-005). Nao desfaz o pareamento: poderia ser um impostor na rede.
 */
export class HubRejectedError extends Error {
  public readonly code = 'HUB_REJECTED';

  public constructor() {
    super('o desktop encontrado recusou este celular');
    this.name = 'HubRejectedError';
  }
}
