import { type LlmFinishReason } from './llm.finish.reason.ts';
import { type LlmToolCall } from './llm.tool.call.ts';
import { type LlmUsage } from './llm.usage.ts';

/** Resultado agregado de um stream (o que `collectStream` devolve). */
export interface LlmResult {
  readonly text: string;
  readonly toolCalls: readonly LlmToolCall[];
  readonly usage: LlmUsage | null;
  readonly finish: LlmFinishReason;
  readonly providerState?: unknown;
}
