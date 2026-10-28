import { type LlmMessage } from '../ports/llm/llm.message.ts';
import { type ContextBuildInput } from './context.build.input.ts';
import { type ContextStrategy } from './context.strategy.ts';
import { estimateTokens } from './estimate.tokens.ts';
import { llmMessageSize } from './llm.message.size.ts';
import { historyToLlmMessages } from './history.to.llm.messages.ts';

/** Fracao padrao da janela de contexto usada pelo prompt (o resto fica para a resposta). */
export const DEFAULT_WINDOW_FRACTION = 0.7;

/**
 * Descarte seguro (spec 031, D12) ate a spec 032 trazer a compactacao: sistema + rodada em curso
 * sempre entram; do historico entram as mensagens MAIS RECENTES que cabem em 70% da janela do
 * modelo (estimativa de ~3,5 caracteres por token). O historico nunca comeca por uma resposta do
 * assistente, e as mensagens mais antigas continuam salvas - so deixam de ir ao modelo.
 */
export class SafeTruncationStrategy implements ContextStrategy {
  private readonly windowFraction: number;

  /** `windowFraction`: parte da janela que o prompt pode ocupar (a compactacao da spec 032 usa mais, pois age antes). */
  public constructor(windowFraction: number = DEFAULT_WINDOW_FRACTION) {
    this.windowFraction = windowFraction;
  }

  public build(input: ContextBuildInput): readonly LlmMessage[] {
    const budget = Math.floor(input.capabilities.contextWindow * this.windowFraction);
    const fixed = estimateTokens(input.system) + input.turn.reduce((sum, m) => sum + llmMessageSize(m), 0);
    let remaining = budget - fixed;
    const history = historyToLlmMessages(input.history);
    const kept: LlmMessage[] = [];
    for (let i = history.length - 1; i >= 0; i -= 1) {
      const message = history[i] as LlmMessage;
      const size = llmMessageSize(message);
      if (size > remaining) break;
      remaining -= size;
      kept.unshift(message);
    }
    while (kept.length > 0 && kept[0]?.role !== 'user') kept.shift();
    return [...kept, ...input.turn];
  }
}
