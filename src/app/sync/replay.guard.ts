/** Quanto tempo um nonce fica lembrado (maior que a janela de horario aceita). */
const TTL_MS = 11 * 60 * 1000;

/**
 * Memoria de nonces ja vistos pelo hub (spec 022, T111): um envelope repetido dentro da janela e
 * recusado. Nonces antigos sao esquecidos - fora da janela de horario o envelope ja e recusado.
 */
export class ReplayGuard {
  private readonly seen = new Map<string, number>();

  /** `true` se o nonce ja foi visto; senao, lembra dele. */
  public check(nonce: string, now: Date): boolean {
    const time = now.getTime();
    for (const [key, expiresAt] of this.seen) if (expiresAt < time) this.seen.delete(key);
    if (this.seen.has(nonce)) return true;
    this.seen.set(nonce, time + TTL_MS);
    return false;
  }
}
