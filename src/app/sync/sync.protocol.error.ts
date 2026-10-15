/** O hub fala outra versao do protocolo - um dos dois precisa ser atualizado (spec 022). */
export class SyncProtocolError extends Error {
  public readonly code = 'PROTOCOL_MISMATCH';

  public constructor(hubVersion: number) {
    super(`o desktop usa a versao ${String(hubVersion)} do protocolo de sincronizacao; atualize o app que estiver mais antigo`);
    this.name = 'SyncProtocolError';
  }
}
