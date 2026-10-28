import { type AfterTurnContext } from '../../after.turn.context.ts';
import { type AfterTurnTask } from '../../after.turn.task.ts';
import { applySignal } from '../../../../domain/preference/lifecycle/apply.signal.ts';
import { MIN_SIGNALS, SIGNAL_WINDOW_DAYS } from '../../../../domain/preference/lifecycle/constants.ts';
import { expirePreference } from '../../../../domain/preference/lifecycle/expire.preference.ts';
import { normalizeText } from '../../../../domain/preference/normalize.text.ts';
import { type Preference } from '../../../../domain/preference/preference.ts';
import { reconcilePreferences } from '../reconcile.preferences.ts';
import { candidateTemplate, type CandidateTemplate } from './candidate.template.ts';
import { detectRepeatedChoice } from './detect.repeated.choice.ts';
import { detectReformulation } from './detect.reformulation.ts';
import { detectStyleFeedback } from './detect.style.feedback.ts';
import { type LearningDeps } from './learning.deps.ts';
import { refineCandidate } from './refine.candidate.ts';
import { type SignalDraft } from './signal.draft.ts';
import { suggestPreference } from './suggest.preference.ts';
import { toLearningTurns } from './to.learning.turns.ts';

/** Quantas mensagens recentes a deteccao le (a janela dos detectores e curta). */
const LOOKBACK = 40;
/** Sinais mais antigos que isto saem (e no maximo 200 por usuario). */
const SIGNAL_RETENTION_DAYS = 60;
const SIGNAL_CAP = 200;
const DAY_MS = 86_400_000;

function sameTarget(p: Preference, t: CandidateTemplate): boolean {
  return normalizeText(p.text) === normalizeText(t.text) && JSON.stringify(p.scope) === JSON.stringify(t.scope);
}

/**
 * Aprendizado organico (spec 032, US2), depois da resposta e fora do caminho dela. Regras locais
 * detectam sinais nas mensagens do usuario; com 3 sinais da mesma chave em 30 dias nasce (ou e
 * reforcada) uma candidata, a menos que o usuario ja a tenha recusado. Estilo vira `tentative`;
 * dados, `candidate`. Uma sugestao discreta por turno, no maximo duas por dia. Nunca lanca para
 * fora: o hook engole e registra.
 */
export class LearningTask implements AfterTurnTask {
  public readonly name = 'agent.learn';
  private readonly deps: LearningDeps;

  public constructor(deps: LearningDeps) {
    this.deps = deps;
  }

  public async run(ctx: AfterTurnContext, signal: AbortSignal): Promise<void> {
    const { memory, store, clock, ids } = this.deps;
    const { stores } = memory;
    const now = clock.now();
    const messages = await store.messages.list(ctx.userId, ctx.conversationId, { limit: LOOKBACK });
    const turns = toLearningTurns(messages);
    const entities = await memory.entities(ctx.userId);
    const drafts: SignalDraft[] = [...detectStyleFeedback(turns), ...detectReformulation(turns), ...detectRepeatedChoice(turns, entities.accounts)];
    for (const draft of drafts) {
      await stores.signals.append({ id: ids.next(), userId: ctx.userId, key: draft.key, kind: draft.kind, messageId: draft.messageId, at: draft.at });
    }
    if (signal.aborted) return;

    const since = new Date(now.getTime() - SIGNAL_WINDOW_DAYS * DAY_MS).toISOString();
    const existing = await stores.preferences.list(ctx.userId);
    let suggested: Preference | null = null;
    for (const key of [...new Set(drafts.map((d) => d.key))]) {
      const template = candidateTemplate(key, entities.accounts);
      if (template === null) continue;
      const count = await stores.signals.countByKey(ctx.userId, key, since);
      if (count < MIN_SIGNALS || (await stores.suppressions.isSuppressed(ctx.userId, key, now.toISOString(), count))) continue;
      const found = existing.find((p) => sameTarget(p, template));
      if (found !== undefined && (found.status === 'active' || found.status === 'disabled')) continue;
      const base = { id: found?.id ?? ids.next(), userId: ctx.userId, text: found?.text ?? template.text, topic: template.topic, scope: template.scope, evidence: count, now, sourceConversationId: ctx.conversationId, sourceMessageId: drafts.find((d) => d.key === key)?.messageId ?? null };
      const next = applySignal(found ?? null, base);
      if (found === undefined) {
        const refined = await this.refine(ctx.userId, template.text, key, drafts, turns, signal);
        await stores.preferences.save(refined === null ? next : { ...next, text: refined });
        suggested ??= refined === null ? next : { ...next, text: refined };
      } else {
        await stores.preferences.save(next);
      }
    }
    if (suggested !== null && !signal.aborted) await suggestPreference(this.deps, ctx, suggested, existing, now);
    await this.housekeeping(ctx.userId, now);
  }

  /** Redacao melhor da candidata, se houver modelo permitido; senao o texto-padrao. */
  private async refine(userId: string, currentText: string, key: string, drafts: readonly SignalDraft[], turns: ReturnType<typeof toLearningTurns>, signal: AbortSignal): Promise<string | null> {
    const llm = await this.deps.refineModel(userId).catch(() => null);
    if (llm === null) return null;
    const ids = new Set(drafts.filter((d) => d.key === key).map((d) => d.messageId));
    return refineCandidate(llm, currentText, turns.filter((t) => ids.has(t.id)).map((t) => t.text), signal);
  }

  /** Poda sinais antigos, expira candidatas/aprendidas paradas e resolve conflito de topico. */
  private async housekeeping(userId: string, now: Date): Promise<void> {
    const { stores } = this.deps.memory;
    await stores.signals.prune(userId, new Date(now.getTime() - SIGNAL_RETENTION_DAYS * DAY_MS).toISOString(), SIGNAL_CAP);
    for (const p of await stores.preferences.list(userId)) {
      const expired = expirePreference(p, now);
      if (expired !== p) await stores.preferences.save(expired);
    }
    await reconcilePreferences(stores, userId, now);
  }
}
