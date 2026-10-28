import { type Consumed } from '../consumed.ts';

/** Resumo de consumo de tokens e custo acumulado de uma conversa (spec 038, FR-001, FR-002). */
export interface ConversationUsageSummary {
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly totalTokens: number;
  readonly costMicroUsd: number;
  readonly runCount: number;
}

export type ConversationUsageItem =
  | { readonly consumed: Consumed }
  | { readonly inputTokens: number; readonly outputTokens: number; readonly costMicroUsd?: number | null };

/**
 * Soma tokens e custo de todas as execucoes (`AgentRun`) ou registros de uma conversa
 * para exibicao no cabecalho do chat.
 */
export function buildConversationUsage(items: readonly ConversationUsageItem[]): ConversationUsageSummary {
  let inputTokens = 0;
  let outputTokens = 0;
  let costMicroUsd = 0;
  for (const item of items) {
    if ('consumed' in item) {
      inputTokens += item.consumed.inputTokens;
      outputTokens += item.consumed.outputTokens;
      costMicroUsd += item.consumed.costMicroUsd ?? 0;
    } else {
      inputTokens += item.inputTokens;
      outputTokens += item.outputTokens;
      costMicroUsd += item.costMicroUsd ?? 0;
    }
  }
  return {
    inputTokens,
    outputTokens,
    totalTokens: inputTokens + outputTokens,
    costMicroUsd,
    runCount: items.length,
  };
}

