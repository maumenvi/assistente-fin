import { PairingError } from './pairing.error.ts';

/** Validade do QR de pareamento (spec 002, RF-6: poucos minutos). */
const TTL_MS = 5 * 60 * 1000;

/** Um QR de pareamento ainda nao usado. */
export interface PendingPairing {
  readonly pairingId: string;
  readonly userId: string;
  readonly secret: string;
  readonly expiresAt: Date;
}

/**
 * QRs de pareamento em aberto, so em memoria do hub (spec 022, T114): uso unico e validade curta.
 * Gerar um novo invalida o anterior (spec 002, RF-7).
 */
export class PairingRegistry {
  private current: PendingPairing | null = null;
  private readonly used = new Set<string>();

  public open(pairing: Omit<PendingPairing, 'expiresAt'>, now: Date): PendingPairing {
    this.current = { ...pairing, expiresAt: new Date(now.getTime() + TTL_MS) };
    return this.current;
  }

  /** O QR aberto, se ainda valido (para o desktop mostrar o tempo restante). */
  public active(now: Date): PendingPairing | null {
    return this.current !== null && this.current.expiresAt > now ? this.current : null;
  }

  /** Consome o QR (uso unico). */
  public take(pairingId: string, now: Date): PendingPairing {
    if (this.used.has(pairingId)) throw new PairingError('PAIRING_USED', 'este QR ja foi usado');
    const pairing = this.current;
    if (pairing === null || pairing.pairingId !== pairingId) throw new PairingError('PAIRING_UNKNOWN', 'QR desconhecido');
    if (pairing.expiresAt <= now) throw new PairingError('PAIRING_EXPIRED', 'QR expirado');
    this.used.add(pairingId);
    this.current = null;
    return pairing;
  }
}
