import { ConcurrencyLimitError } from '../../../domain/agent/errors/concurrency.limit.error.ts';
import { MAX_CONCURRENT_RUNS } from '../../../domain/agent/max.concurrent.runs.ts';
import { type ActiveRun } from './active.run.ts';

/**
 * Registro das execucoes em andamento neste processo (spec 031): garante UMA execucao ativa por
 * conversa e permite cancelar por `runId`.
 */
export class ActiveRuns {
  private readonly byRun = new Map<string, ActiveRun>();
  private readonly muted = new Set<string>();

  public hasConversation(conversationId: string): boolean {
    for (const run of this.byRun.values()) if (run.conversationId === conversationId) return true;
    return false;
  }

  /** Recusa uma execucao nova quando o teto de conversas simultaneas ja foi atingido (spec 040, FR-008). */
  public assertCapacity(limit: number = MAX_CONCURRENT_RUNS): void {
    if (this.byRun.size >= limit) throw new ConcurrencyLimitError(limit);
  }

  public register(run: ActiveRun): void {
    this.byRun.set(run.runId, run);
  }

  public release(runId: string): void {
    this.byRun.delete(runId);
    this.muted.delete(runId);
  }

  /** Pede para a execucao parar; `false` se ela nao esta mais ativa. */
  public cancel(runId: string): boolean {
    const run = this.byRun.get(runId);
    if (run === undefined) return false;
    run.controller.abort();
    return true;
  }

  /**
   * Fim da sessao de um usuario: cancela e SILENCIA as execucoes dele (nenhum evento mais sai
   * delas). Devolve os ids cancelados.
   */
  public cancelUser(userId: string): string[] {
    const ids: string[] = [];
    for (const run of this.byRun.values()) {
      if (run.userId !== userId) continue;
      this.muted.add(run.runId);
      run.controller.abort();
      ids.push(run.runId);
    }
    return ids;
  }

  /** A execucao foi silenciada (sessao encerrada): seus eventos nao devem mais ser publicados. */
  public isMuted(runId: string): boolean {
    return this.muted.has(runId);
  }

  /** Pede para parar toda execucao ativa de uma conversa (ao apagar a conversa). */
  public cancelConversation(conversationId: string): void {
    for (const run of this.byRun.values()) if (run.conversationId === conversationId) run.controller.abort();
  }

  /** Pede para parar todas as execucoes ativas (ao apagar todo o historico). */
  public cancelAll(): void {
    for (const run of this.byRun.values()) run.controller.abort();
  }

  /** Espera o fim de uma execucao (testes e encerramento); resolve na hora se nao esta ativa. */
  public settled(runId: string): Promise<void> {
    return this.byRun.get(runId)?.settled ?? Promise.resolve();
  }

  public activeRunIds(): string[] {
    return [...this.byRun.keys()];
  }
}
