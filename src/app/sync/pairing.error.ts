/** Motivos de recusa do pareamento e da autenticacao do aparelho (contracts/pairing-qr.md). */
export type PairingErrorCode = 'PAIRING_UNKNOWN' | 'PAIRING_EXPIRED' | 'PAIRING_USED' | 'DEVICE_UNKNOWN' | 'DEVICE_REVOKED';

/** Pareamento ou aparelho recusado. */
export class PairingError extends Error {
  public readonly code: PairingErrorCode;

  public constructor(code: PairingErrorCode, message: string) {
    super(message);
    this.name = 'PairingError';
    this.code = code;
  }
}
