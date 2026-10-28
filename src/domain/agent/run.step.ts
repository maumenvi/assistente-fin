import { type ToolCallRecord } from './tool.call.record.ts';

/** Um passo (no do grafo) executado dentro de uma execucao (spec 031, data-model.md 1). */
export interface RunStep {
  readonly id: string;
  readonly runId: string;
  /** Ordem na execucao. */
  readonly seq: number;
  /** Nome do no (igual ao do diagrama). */
  readonly node: string;
  readonly fromNode: string | null;
  readonly toNode: string | null;
  readonly status: 'ok' | 'error' | 'cancelled';
  readonly startedAt: string;
  readonly durationMs: number;
  /** Papel do modelo usado (`null` em nos sem LLM). */
  readonly role: 'main' | 'fast' | 'fallback' | null;
  readonly model: string | null;
  readonly inputTokens: number | null;
  readonly outputTokens: number | null;
  readonly cachedTokens: number | null;
  readonly costMicroUsd: number | null;
  readonly toolCalls: readonly ToolCallRecord[];
  /** Mensagens enviadas ao modelo (teto de 32 KB). */
  readonly request: unknown;
  /** Resposta bruta resumida (teto de 32 KB). */
  readonly response: unknown;
  /** Verdadeiro quando `request` ou `response` foram cortados no teto. */
  readonly truncated: boolean;
  readonly error: { readonly code: string; readonly message: string } | null;
}
