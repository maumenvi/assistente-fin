/** Celular pareado com o hub (spec 022, FR-008/FR-014). */
export interface PairedDevice {
  readonly id: string;
  readonly userId: string;
  readonly name: string;
  /** SHA-256 do token do aparelho - o token em si nunca e guardado. */
  readonly tokenHash: string;
  /** Chave do envelope do aparelho, cifrada com a chave local do desktop. */
  readonly keyCiphertext: string;
  readonly createdAt: Date;
  readonly lastSeenAt: Date | null;
  readonly revokedAt: Date | null;
}
