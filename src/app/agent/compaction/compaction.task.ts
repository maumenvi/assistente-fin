import { type AgentMessage } from '../../../domain/agent/agent.message.ts';
import { type ConversationSummary } from '../../../domain/agent/summary/conversation.summary.ts';
import { type AfterTurnContext } from '../after.turn.context.ts';
import { type AfterTurnTask } from '../after.turn.task.ts';
import { historyToLlmMessages } from '../context/history.to.llm.messages.ts';
import { estimateTokens } from '../context/estimate.tokens.ts';
import { llmMessageSize } from '../context/llm.message.size.ts';
import { PREFERENCE_BUDGET_TOKENS } from '../../../domain/preference/select/fit.budget.ts';
import { type CompactionDeps } from './compaction.deps.ts';
import { CompactionState } from './compaction.state.ts';
import { loadUncovered } from './load.uncovered.ts';
import { pickBlock } from './pick.block.ts';
import { shouldCompact } from './should.compact.ts';
import { summarizeBlock } from './summarize.block.ts';

/** Prompt-base estimado (regras do assistente + data), antes de preferencias e resumo. */
const SYSTEM_BASE_TOKENS = 800;

function messagesTokens(messages: readonly AgentMessage[]): number {
  return historyToLlmMessages(messages).reduce((sum, m) => sum + llmMessageSize(m), 0);
}

/**
 * Compactacao da conversa (spec 032, US4), depois do turno e fora do caminho da resposta. Quando o
 * contexto atinge o limiar da janela do modelo, resume o bloco antigo (incremental, sem valores) e
 * troca o resumo corrente; o historico NUNCA e alterado (so ganha a marca "Contexto resumido").
 * Falha, modelo indisponivel ou sessao encerrada nao mudam nada: o contexto segue no descarte seguro.
 */
export class CompactionTask implements AfterTurnTask {
  public readonly name = 'agent.compact';
  private readonly deps: CompactionDeps;
  private readonly state = new CompactionState();

  public constructor(deps: CompactionDeps) {
    this.deps = deps;
  }

  public async run(ctx: AfterTurnContext, signal: AbortSignal): Promise<void> {
    const { store, clock, ids } = this.deps;
    const model = await this.deps.model(ctx.userId);
    if (model === null || !this.state.begin(ctx.conversationId, model.modelKey)) return;
    let outcome: 'done' | 'failed' | 'skipped' = 'skipped';
    try {
      const previous = await store.summaries.getCurrent(ctx.userId, ctx.conversationId);
      const uncovered = await loadUncovered(store, ctx.userId, ctx.conversationId, previous?.coveredToSeq ?? 0);
      const fixedTokens = SYSTEM_BASE_TOKENS + PREFERENCE_BUDGET_TOKENS + (previous?.tokensEstimate ?? 0);
      if (!shouldCompact({ fixedTokens, messageTokens: messagesTokens(uncovered), contextWindow: model.contextWindow })) return;
      const block = pickBlock(uncovered, model.contextWindow);
      if (block === null) return;
      const entities = await this.deps.memory.entities(ctx.userId);
      const result = await summarizeBlock({
        llm: model.llm, system: this.deps.systemPrompt(), previous: previous?.content ?? null, block: block.messages,
        accounts: entities.accounts, categories: entities.categories, signal,
      });
      if (signal.aborted) return;
      if (!result.ok) {
        outcome = 'failed';
        this.deps.log.warn('compactacao falhou; seguindo com o descarte seguro', { reason: result.reason, calls: result.calls });
        return;
      }
      const summary: ConversationSummary = {
        id: ids.next(), userId: ctx.userId, conversationId: ctx.conversationId, coveredFromSeq: previous?.coveredFromSeq ?? block.fromSeq, coveredToSeq: block.toSeq,
        content: result.content, modelProfileId: model.profileId, tokensEstimate: estimateTokens(JSON.stringify(result.content)), generation: (previous?.generation ?? 0) + 1,
        createdAt: clock.now().toISOString(),
      };
      await store.summaries.replaceCurrent(summary);
      const marked = block.messages.at(-1) as AgentMessage;
      await this.moveMarker(ctx, summary, previous, marked);
      this.deps.events.publish({
        type: 'summary_updated', runId: `${ctx.runId}:compact`, conversationId: ctx.conversationId, seq: 1,
        messageId: marked.id, summaryId: summary.id, coveredFromSeq: summary.coveredFromSeq, coveredToSeq: summary.coveredToSeq,
      });
      outcome = 'done';
    } catch (error) {
      outcome = 'failed';
      this.deps.log.warn('compactacao falhou; seguindo com o descarte seguro', { error: error instanceof Error ? error.message : String(error) });
    } finally {
      if (outcome === 'done') this.state.succeeded(ctx.conversationId);
      else if (outcome === 'failed') this.state.failed(ctx.conversationId);
      else this.state.release(ctx.conversationId);
    }
  }

  /** O item "Contexto resumido" so existe uma vez: sai da mensagem do corte anterior e vai para a nova. */
  private async moveMarker(ctx: AfterTurnContext, summary: ConversationSummary, previous: ConversationSummary | null, marked: AgentMessage): Promise<void> {
    const { store } = this.deps;
    if (previous !== null) {
      const [old] = await store.messages.list(ctx.userId, ctx.conversationId, { limit: 1, beforeSeq: previous.coveredToSeq + 1 });
      if (old !== undefined && old.parts.some((p) => p.type === 'summary_marker')) {
        await store.messages.update(ctx.userId, old.id, { parts: old.parts.filter((p) => p.type !== 'summary_marker') });
      }
    }
    const parts = [...marked.parts.filter((p) => p.type !== 'summary_marker'), { type: 'summary_marker' as const, summaryId: summary.id, coveredFromSeq: summary.coveredFromSeq, coveredToSeq: summary.coveredToSeq }];
    await store.messages.update(ctx.userId, marked.id, { parts });
  }
}
