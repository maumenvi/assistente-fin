import { type ToolCallRecord } from '../../../domain/agent/tool.call.record.ts';

/** Um passo na linha do tempo da execucao. Ao vivo vem so o resumo; o detalhe vem do historico. */
export interface ViewStep {
  readonly seq: number;
  readonly node: string;
  /** Rotulo pt-BR do no (o mesmo do diagrama). */
  readonly label: string;
  readonly status: 'ok' | 'error' | 'cancelled';
  readonly durationMs: number;
  readonly model: string | null;
  readonly inputTokens: number | null;
  readonly outputTokens: number | null;
  readonly costMicroUsd: number | null;
  readonly toolNames: readonly string[];
  /** Consultas do passo (vazio ao vivo ate o detalhe carregar). */
  readonly toolCalls: readonly ToolCallRecord[];
  readonly request: unknown;
  readonly response: unknown;
  readonly truncated: boolean;
  readonly error: { readonly code: string; readonly message: string } | null;
}
