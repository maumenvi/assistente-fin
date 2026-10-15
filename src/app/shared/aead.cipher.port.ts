/**
 * Cifra autenticada com dados associados (AES-256-GCM + AAD) (spec 022, R5): o envelope da
 * sincronizacao amarra o texto cifrado ao aparelho e ao horario, sem que eles viagem cifrados.
 */
export interface AeadCipher {
  seal(plaintext: string, aad: string): string;
  /** Lanca se a chave, o AAD ou o texto nao conferirem. */
  open(sealed: string, aad: string): string;
}
