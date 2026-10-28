import { type LlmFinishReason } from '../../ports/llm/llm.finish.reason.ts';
import { type LlmToolCall } from '../../ports/llm/llm.tool.call.ts';
import { type LlmUsage } from '../../ports/llm/llm.usage.ts';

/** Uma geracao do modelo ja agregada (texto, chamadas de ferramenta, uso). */
export interface ModelTurn {
  readonly text: string;
  readonly toolCalls: readonly LlmToolCall[];
  readonly usage: LlmUsage | null;
  readonly providerState?: unknown;
  readonly finish: LlmFinishReason;
}
