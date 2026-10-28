/** Falhas seguidas depois das quais a compactacao pausa ate o modelo mudar. */
export const MAX_CONSECUTIVE_FAILURES = 3;

interface Entry {
  running: boolean;
  failures: number;
  modelKey: string;
}

/**
 * Estado da compactacao por conversa (spec 032, contracts/compaction.md): um trabalho por vez, e
 * pausa depois de 3 falhas seguidas - ate o usuario trocar de modelo (a chave do modelo muda).
 */
export class CompactionState {
  private readonly byConversation = new Map<string, Entry>();

  /** Reserva a conversa para um trabalho; `false` se ja ha um rodando ou se pausou por falhas. */
  public begin(conversationId: string, modelKey: string): boolean {
    const entry = this.byConversation.get(conversationId) ?? { running: false, failures: 0, modelKey };
    if (entry.modelKey !== modelKey) {
      entry.failures = 0;
      entry.modelKey = modelKey;
    }
    if (entry.running || entry.failures >= MAX_CONSECUTIVE_FAILURES) {
      this.byConversation.set(conversationId, entry);
      return false;
    }
    entry.running = true;
    this.byConversation.set(conversationId, entry);
    return true;
  }

  public succeeded(conversationId: string): void {
    const entry = this.byConversation.get(conversationId);
    if (entry !== undefined) {
      entry.running = false;
      entry.failures = 0;
    }
  }

  public failed(conversationId: string): void {
    const entry = this.byConversation.get(conversationId);
    if (entry !== undefined) {
      entry.running = false;
      entry.failures += 1;
    }
  }

  /** Libera a reserva sem contar sucesso nem falha (nada a fazer, ou trabalho descartado). */
  public release(conversationId: string): void {
    const entry = this.byConversation.get(conversationId);
    if (entry !== undefined) entry.running = false;
  }
}
