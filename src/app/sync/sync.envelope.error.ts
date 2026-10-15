/** Motivos de recusa de um envelope da sincronizacao (contracts/sync-protocol.md). */
export type SyncEnvelopeErrorCode = 'BAD_ENVELOPE' | 'STALE_REQUEST' | 'REPLAY';

/** Envelope recusado: cifra/AAD invalidos, fora da janela de tempo ou repetido. */
export class SyncEnvelopeError extends Error {
  public readonly code: SyncEnvelopeErrorCode;

  public constructor(code: SyncEnvelopeErrorCode, message: string) {
    super(message);
    this.name = 'SyncEnvelopeError';
    this.code = code;
  }
}
