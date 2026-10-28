import { type AgentTracePort } from '../ports/observe/agent.trace.port.ts';
import { type TraceEvent } from '../ports/observe/trace.event.ts';

/**
 * Unico jeito de um no emitir trace (spec 031, FR-037): qualquer excecao do destino e engolida,
 * para o trace NUNCA afetar o agente.
 */
export function emitSafely(trace: AgentTracePort, event: TraceEvent): void {
  try {
    trace.emit(event);
  } catch {
    // o trace nunca derruba o fluxo principal
  }
}
