/** Namespace fixo dos ids derivados do app (UUID aleatorio escolhido uma vez, spec 022). */
export const FINANCE_CONTROLLER_UUID_NAMESPACE = '6f1c2d3e-8a4b-4c5d-9e6f-7a8b9c0d1e2f';

/** Bytes do namespace (16), para concatenar com o nome antes do SHA-1. */
export function uuidToBytes(uuid: string): Uint8Array {
  const hex = uuid.replace(/-/g, '');
  const bytes = new Uint8Array(16);
  for (let i = 0; i < 16; i += 1) bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return bytes;
}

/**
 * Monta um UUID v5 (RFC 4122) a partir dos 20 bytes do SHA-1 de `namespace || nome`: pega os
 * 16 primeiros, marca versao 5 e variante RFC.
 */
export function formatUuidV5(sha1: Uint8Array): string {
  const bytes = sha1.slice(0, 16);
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x50;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
