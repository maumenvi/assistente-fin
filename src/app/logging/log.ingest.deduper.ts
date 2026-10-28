/**
 * Lembra os ultimos ids de eventos ja recebidos para descartar reenvios (spec 017, RF-22: entrega
 * pelo menos uma vez). LRU simples em memoria; a janela de reenvio e curta (uma resposta perdida),
 * entao o limite e folgado e o boot semeia com os ids do fim do `app.jsonl`.
 */
export class LogIngestDeduper {
  private readonly limit: number;
  private readonly ids = new Set<string>();

  public constructor(limit = 20_000) {
    this.limit = limit;
  }

  /** Registra `id` e diz se ja tinha sido visto (`true` = duplicata). */
  public seen(id: string): boolean {
    if (this.ids.has(id)) {
      // renova a posicao (mais recente)
      this.ids.delete(id);
      this.ids.add(id);
      return true;
    }
    this.ids.add(id);
    if (this.ids.size > this.limit) {
      const oldest = this.ids.values().next().value;
      if (oldest !== undefined) this.ids.delete(oldest);
    }
    return false;
  }

  /** Marca ids como ja vistos sem contar duplicata (semeadura no boot). */
  public seed(ids: readonly string[]): void {
    for (const id of ids) this.seen(id);
  }
}
