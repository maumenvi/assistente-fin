import { type LlmEvent } from '../../../app/agent/ports/llm/llm.event.ts';
import { type ReplayError } from './replay.error.ts';

/** Uma resposta gravada do modelo: os eventos na ordem e, opcionalmente, uma falha no fim. */
export interface ReplayTurn {
  readonly events: readonly LlmEvent[];
  /** Pausa antes de cada evento, em ms (para testar parada e fluidez). */
  readonly delayMs?: number;
  readonly error?: ReplayError;
}
