/** Segredos aleatorios e hash para pareamento e tokens (spec 022). */
export interface SecretGenerator {
  /** `bytes` bytes aleatorios em hexadecimal. */
  randomHex(bytes: number): string;
  /** SHA-256 do texto em hexadecimal. */
  sha256Hex(text: string): string;
}
