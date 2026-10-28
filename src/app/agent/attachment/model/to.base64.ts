const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/** Base64 de bytes sem `Buffer`/`btoa` (codigo compartilhado com o Hermes). */
export function toBase64(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const n = ((bytes[i] as number) << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);
    out += ALPHABET.charAt((n >> 18) & 63) + ALPHABET.charAt((n >> 12) & 63) + (i + 1 < bytes.length ? ALPHABET.charAt((n >> 6) & 63) : '=') + (i + 2 < bytes.length ? ALPHABET.charAt(n & 63) : '=');
  }
  return out;
}
