import { type ConversationSummary } from '../../../../domain/agent/summary/conversation.summary.ts';
import { type AgentMessage } from '../../../../domain/agent/agent.message.ts';
import { type Preference } from '../../../../domain/preference/preference.ts';
import { fitBudget, PREFERENCE_BUDGET_TOKENS } from '../../../../domain/preference/select/fit.budget.ts';
import { isSendable } from '../../../../domain/preference/select/is.sendable.ts';
import { orderStable } from '../../../../domain/preference/select/order.stable.ts';
import { selectRelevant } from '../../../../domain/preference/select/select.relevant.ts';
import { estimateTokens } from '../../context/estimate.tokens.ts';
import { extractPinnedConstraints } from '../../compaction/pick.block.ts';
import { lastQueryAnchorLine } from '../../compaction/query.ref.line.ts';
import { reconcilePreferences } from '../../preference/reconcile.preferences.ts';
import { type NodeContext } from '../node.context.ts';

/** Quantas mensagens recentes do historico contam para achar a conta/categoria citada. */
const MENTION_LOOKBACK = 6;

/** O que a memoria entrega ao contexto de um turno. */
export interface TurnMemory {
  readonly preferences: readonly Preference[];
  readonly summary: ConversationSummary | null;
  readonly pinnedConstraints?: readonly string[] | undefined;
  readonly lastQueryAnchor?: string | undefined;
}

function textOf(message: AgentMessage): string {
  return message.parts.flatMap((p) => (p.type === 'text' ? [p.text] : [])).join(' ');
}

/**
 * Preferencias e resumo do turno (spec 032, contracts/context.strategy.md): resolve conflito por
 * topico, seleciona as relevantes ao pedido (globais; conta/categoria so quando citadas), tira as
 * privadas se algum modelo da execucao e de nuvem, ordena de forma estavel e corta no orcamento.
 * Marca as usadas (fora do caminho critico). Sem memoria configurada devolve vazio.
 */
export async function loadTurnMemory(ctx: NodeContext, userText: string, history: readonly AgentMessage[]): Promise<TurnMemory> {
  const summary = await ctx.store.summaries.getCurrent(ctx.userId, ctx.conversationId).catch(() => null);
  const pinnedConstraints = extractPinnedConstraints(history);
  const lastQueryAnchor = lastQueryAnchorLine(history);
  const anchorExtras = {
    ...(pinnedConstraints.length > 0 ? { pinnedConstraints } : {}),
    ...(lastQueryAnchor !== '' ? { lastQueryAnchor } : {}),
  };
  if (ctx.memory === undefined) return { preferences: [], summary, ...anchorExtras };
  try {
    const { stores } = ctx.memory;
    await reconcilePreferences(stores, ctx.userId, ctx.clock.now());
    const candidates = await stores.preferences.list(ctx.userId, { status: ['active', 'tentative'] });
    const entities = await ctx.memory.entities(ctx.userId);
    const relevant = selectRelevant(candidates, {
      userText,
      history: history.slice(-MENTION_LOOKBACK).map(textOf),
      accounts: entities.accounts,
      categories: entities.categories,
    }).filter((p) => isSendable(p, ctx.cloud));
    const preferences = fitBudget(orderStable(relevant), PREFERENCE_BUDGET_TOKENS, estimateTokens);
    if (preferences.length > 0) {
      stores.preferences.markUsed(ctx.userId, preferences.map((p) => p.id), ctx.clock.now().toISOString()).catch((error: unknown) => {
        ctx.log.warn('falha ao marcar o uso das preferencias', { error: error instanceof Error ? error.message : String(error) });
      });
    }
    return { preferences, summary, ...anchorExtras };
  } catch (error) {
    ctx.log.warn('falha ao carregar as preferencias; seguindo sem elas', { error: error instanceof Error ? error.message : String(error) });
    return { preferences: [], summary, ...anchorExtras };
  }
}
