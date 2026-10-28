import { type LimitReason } from './graph.ts';

/** Resultado de `runGraph`. O runner nunca lanca: falhas viram `status: 'failed'` com o erro. */
export interface RunOutcome<State> {
  readonly status: 'done' | 'failed' | 'cancelled';
  readonly state: State;
  /** Qual limite do orcamento estourou (a execucao termina `done` com resposta parcial). */
  readonly limit: LimitReason | null;
  readonly error: Error | null;
}
