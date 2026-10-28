import { type AfterTurnContext } from '../../after.turn.context.ts';
import { type Preference } from '../../../../domain/preference/preference.ts';
import { type LearningDeps } from './learning.deps.ts';

/** No maximo duas sugestoes por dia (spec 032, contracts/learning.md). */
const MAX_SUGGESTIONS_PER_DAY = 2;

/**
 * Sugestao discreta (spec 032, FR-005): anexa a parte `suggestion` na resposta do turno e avisa a
 * tela. Respeita o limite diario (contado pelas aprendidas criadas hoje). Uma por turno - o chamador
 * passa so a primeira candidata nova.
 */
export async function suggestPreference(deps: LearningDeps, ctx: AfterTurnContext, candidate: Preference, others: readonly Preference[], now: Date): Promise<void> {
  const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
  const today = others.filter((p) => p.origin === 'learned' && p.createdAt >= startOfDay && p.id !== candidate.id).length;
  if (today >= MAX_SUGGESTIONS_PER_DAY) return;
  const messages = await deps.store.messages.list(ctx.userId, ctx.conversationId, { limit: 20 });
  const message = messages.find((m) => m.id === ctx.assistantMessageId);
  if (message === undefined || message.parts.some((p) => p.type === 'suggestion' && p.preferenceId === candidate.id)) return;
  await deps.store.messages.update(ctx.userId, message.id, { parts: [...message.parts, { type: 'suggestion', preferenceId: candidate.id, text: candidate.text, state: 'open' }] });
  deps.events.publish({
    type: 'preference_suggested', runId: `${ctx.runId}:learn`, conversationId: ctx.conversationId, seq: 1, messageId: message.id, preferenceId: candidate.id, text: candidate.text,
  });
}
