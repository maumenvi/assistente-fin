import { z } from 'zod';
import { type AeadCipher } from '../shared/aead.cipher.port.ts';
import { SyncEnvelopeError } from './sync.envelope.error.ts';

/** Janela aceita entre o relogio do celular e o do hub. */
const MAX_SKEW_MS = 5 * 60 * 1000;

/** Envelope cifrado que viaja em todo corpo do protocolo (contracts/sync-protocol.md). */
export const syncEnvelopeSchema = z.object({
  deviceId: z.string().trim().min(1).max(100),
  nonce: z.string().trim().min(8).max(100),
  ts: z.iso.datetime({ offset: true }),
  ct: z.string().min(1),
});

export type SyncEnvelope = z.infer<typeof syncEnvelopeSchema>;

function aad(envelope: Pick<SyncEnvelope, 'deviceId' | 'nonce' | 'ts'>): string {
  return `${envelope.deviceId}|${envelope.ts}|${envelope.nonce}`;
}

/** Cifra um payload JSON para o outro lado (spec 022, T111). */
export function sealEnvelope(cipher: AeadCipher, deviceId: string, nonce: string, now: Date, payload: unknown): SyncEnvelope {
  const header = { deviceId, nonce, ts: now.toISOString() };
  return { ...header, ct: cipher.seal(JSON.stringify(payload), aad(header)) };
}

/**
 * Abre um envelope (spec 022, T111): recusa horario fora de +-5 min (`STALE_REQUEST`), nonce ja
 * visto (`REPLAY`, via `seen`) e qualquer adulteracao de cifra, aparelho, horario ou nonce
 * (`BAD_ENVELOPE`). Devolve o payload ja como objeto.
 */
export function openEnvelope(
  cipher: AeadCipher,
  raw: unknown,
  now: Date,
  seen: (nonce: string, ts: Date) => boolean,
): { deviceId: string; payload: unknown } {
  const parsed = syncEnvelopeSchema.safeParse(raw);
  if (!parsed.success) throw new SyncEnvelopeError('BAD_ENVELOPE', 'envelope com forma invalida');
  const envelope = parsed.data;
  const ts = new Date(envelope.ts);
  if (Math.abs(now.getTime() - ts.getTime()) > MAX_SKEW_MS) {
    throw new SyncEnvelopeError('STALE_REQUEST', 'relogio do aparelho fora da janela aceita');
  }
  let plaintext: string;
  try {
    plaintext = cipher.open(envelope.ct, aad(envelope));
  } catch {
    throw new SyncEnvelopeError('BAD_ENVELOPE', 'nao foi possivel decifrar');
  }
  if (seen(envelope.nonce, ts)) throw new SyncEnvelopeError('REPLAY', 'envelope repetido');
  try {
    return { deviceId: envelope.deviceId, payload: JSON.parse(plaintext) as unknown };
  } catch {
    throw new SyncEnvelopeError('BAD_ENVELOPE', 'conteudo invalido');
  }
}
