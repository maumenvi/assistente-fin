import { z } from 'zod';

/** Conteudo do QR de pareamento v2 (contracts/pairing-qr.md). */
export const pairingQrPayloadSchema = z.object({
  v: z.literal(2),
  hubId: z.string().min(1),
  hosts: z.array(z.string().min(1)).min(1).max(8),
  port: z.int().min(1).max(65535),
  pairingId: z.string().min(1),
  secret: z.string().regex(/^[0-9a-f]{64}$/),
  expiresAt: z.iso.datetime({ offset: true }),
});

export type PairingQrPayload = z.infer<typeof pairingQrPayloadSchema>;

const PREFIX = 'financecontroller://pair?d=';

function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(text: string): string {
  const padded = text.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(text.length / 4) * 4, '=');
  const binary = atob(padded);
  return new TextDecoder().decode(Uint8Array.from(binary, (ch) => ch.charCodeAt(0)));
}

/** Monta o texto do QR. */
export function encodePairingQr(payload: PairingQrPayload): string {
  return PREFIX + toBase64Url(JSON.stringify(payload));
}

/** Le o texto do QR (zod na fronteira); `null` se nao for um QR de pareamento valido. */
export function decodePairingQr(text: string): PairingQrPayload | null {
  if (!text.startsWith(PREFIX)) return null;
  try {
    const parsed = pairingQrPayloadSchema.safeParse(JSON.parse(fromBase64Url(text.slice(PREFIX.length))));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
