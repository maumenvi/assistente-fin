/** Linha da linha do tempo ao vivo (resumo de um passo). */
export interface RunStepSummary {
  readonly seq: number;
  readonly node: string;
  readonly status: 'ok' | 'error' | 'cancelled';
  readonly durationMs: number;
  readonly model: string | null;
  readonly inputTokens: number | null;
  readonly outputTokens: number | null;
  readonly costMicroUsd: number | null;
  readonly toolNames: readonly string[];
}
