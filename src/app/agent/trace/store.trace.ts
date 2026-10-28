import { type AgentStorePort } from '../ports/store/agent.store.port.ts';
import { type AgentLogPort } from '../ports/observe/agent.log.port.ts';
import { type AgentTracePort } from '../ports/observe/agent.trace.port.ts';
import { type TraceEvent } from '../ports/observe/trace.event.ts';
import { type RunStep } from '../../../domain/agent/run.step.ts';
import { type StoreTraceOptions } from './store.trace.options.ts';
import { truncateStep } from './truncate.step.ts';

interface PendingStep {
  readonly userId: string;
  readonly step: RunStep;
}

/**
 * Trace que grava os passos no `AgentStorePort` em segundo plano (spec 031, D16, FR-037).
 * `emit` so coloca na fila e retorna (sem I/O, sem promessa, sem excecao); a fila e limitada
 * (500; o mais antigo cai e a perda e contada em log); um escritor drena em lotes (50 eventos ou
 * 250 ms); qualquer falha de gravacao vira `log.warn` e a execucao nunca percebe. Outros eventos
 * (inicio e fim de execucao) sao gravados de forma sincrona pelo runner, nao aqui.
 */
export class StoreTrace implements AgentTracePort {
  private readonly store: AgentStorePort;
  private readonly log: AgentLogPort;
  private readonly maxQueue: number;
  private readonly batchSize: number;
  private readonly flushIntervalMs: number;
  private readonly schedule: (work: () => void, ms: number) => () => void;
  private queue: PendingStep[] = [];
  private dropped = 0;
  private cancelTimer: (() => void) | null = null;
  private draining: Promise<void> = Promise.resolve();

  public constructor(store: AgentStorePort, log: AgentLogPort, options: StoreTraceOptions = {}) {
    this.store = store;
    this.log = log;
    this.maxQueue = options.maxQueue ?? 500;
    this.batchSize = options.batchSize ?? 50;
    this.flushIntervalMs = options.flushIntervalMs ?? 250;
    this.schedule =
      options.schedule ??
      ((work, ms) => {
        const handle = setTimeout(work, ms);
        return () => clearTimeout(handle);
      });
  }

  public emit(event: TraceEvent): void {
    try {
      if (event.type !== 'step') return;
      this.queue.push({ userId: event.userId, step: truncateStep(event.step) });
      if (this.queue.length > this.maxQueue) {
        this.queue.shift();
        this.dropped += 1;
      }
      if (this.queue.length >= this.batchSize) this.kick(0);
      else if (this.cancelTimer === null) this.kick(this.flushIntervalMs);
    } catch {
      // o trace nunca derruba o fluxo principal
    }
  }

  public async flush(deadlineMs: number): Promise<void> {
    this.cancelPending();
    const work = this.drain();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const limit = new Promise<void>((resolve) => {
      timer = setTimeout(resolve, deadlineMs);
    });
    try {
      await Promise.race([work, limit]);
    } finally {
      clearTimeout(timer);
    }
  }

  private kick(ms: number): void {
    this.cancelPending();
    this.cancelTimer = this.schedule(() => {
      this.cancelTimer = null;
      void this.drain();
    }, ms);
  }

  private cancelPending(): void {
    this.cancelTimer?.();
    this.cancelTimer = null;
  }

  /** Grava o que esta na fila, depois do lote anterior; nunca rejeita. */
  private drain(): Promise<void> {
    this.draining = this.draining.then(() => this.writeAll()).catch(() => undefined);
    return this.draining;
  }

  private async writeAll(): Promise<void> {
    if (this.dropped > 0) {
      this.log.warn('trace: eventos descartados por fila cheia', { dropped: this.dropped });
      this.dropped = 0;
    }
    const batch = this.queue;
    this.queue = [];
    if (batch.length === 0) return;
    const byUser = new Map<string, RunStep[]>();
    for (const item of batch) byUser.set(item.userId, [...(byUser.get(item.userId) ?? []), item.step]);
    for (const [userId, steps] of byUser) {
      try {
        await this.store.steps.appendMany(userId, steps);
      } catch (error) {
        this.log.warn('trace: falha ao gravar passos', { steps: steps.length, error: error instanceof Error ? error.message : String(error) });
      }
    }
  }
}
