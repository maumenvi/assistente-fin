/**
 * Algo respondeu no endereco, mas nao e o desktop pareado: `hubId` diferente ou desafio que nao
 * abre com a chave do aparelho (spec 024, FR-005).
 */
export class HubIdentityMismatchError extends Error {
  public readonly code = 'HUB_IDENTITY_MISMATCH';

  public constructor(host: string) {
    super(`${host} nao e o desktop pareado com este celular`);
    this.name = 'HubIdentityMismatchError';
  }
}
