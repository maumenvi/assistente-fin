import { type TraceEvent } from './trace.event.ts';

/**
 * Destino do trace de execucao (spec 031, FR-037/FR-038). `emit` e sincrono, barato, NUNCA lanca e
 * NUNCA devolve promessa: uma falha de gravacao jamais chega ao agente.
 */
export interface AgentTracePort {
  emit(event: TraceEvent): void;
  /** Esvazia o que estiver em fila (encerramento do app). Melhor esforco, com prazo. */
  flush(deadlineMs: number): Promise<void>;
}
