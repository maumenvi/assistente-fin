import { type MessagePart } from '../../../../domain/agent/message.part.ts';
import { type NoticePart } from '../../../../domain/agent/notice.part.ts';
import { END } from '../end.ts';
import { FactLedger } from '../../verify/fact.ledger.ts';
import { maskFigures } from '../../verify/mask.figures.ts';
import { verifyFigures } from '../../verify/verify.figures.ts';
import { type AgentNodeName } from '../agent.node.name.ts';
import { type AgentState } from '../agent.state.ts';
import { defineNode } from '../define.node.ts';
import { type NodeContext } from '../node.context.ts';
import { appliedParts } from './applied.parts.ts';
import { capabilityRequestParts } from './capability.request.parts.ts';
import { reportParts } from './report.parts.ts';
import { planParts } from './plan.parts.ts';
import { buildCorrectionNote } from './build.correction.note.ts';
import { userTextOfTurn } from './user.text.of.turn.ts';

/** Texto quando o modelo terminou sem dizer nada. */
const EMPTY_ANSWER = 'O modelo não devolveu uma resposta agora. Tente de novo; em modelo local isso costuma ser a janela de contexto pequena (aumente-a no servidor) ou um modelo pequeno demais.';

const UNVERIFIED_NOTICE: NoticePart = {
  type: 'notice',
  kind: 'figures_unverified',
  text: 'Alguns valores da resposta não puderam ser confirmados nos seus dados e foram ocultados.',
};

const IMAGE_NOTICE: NoticePart = {
  type: 'notice',
  kind: 'image_figures',
  text: 'Li os valores da imagem enviada; confira com o original antes de usar.',
};

/** O turno levou imagem ao modelo: os valores lidos dela nao estao no ledger e nao podem ser confirmados pelo app. */
function turnHasImage(state: AgentState): boolean {
  return state.turnMessages.some((m) => typeof m.content !== 'string' && m.content.some((part) => part.type === 'image'));
}

/**
 * No `respond` (spec 031, T072): confere cada valor, percentual, data e quantidade do texto final
 * contra o ledger de fatos (mais o que o proprio usuario escreveu). Divergencia -> UMA correcao:
 * limpa o texto exibido e volta ao `react` com a lista de valores permitidos. Persistindo,
 * mascara o que nao foi confirmado e marca `figures_unverified`. Grava a mensagem final
 * (cartoes "Consultei" + texto + avisos) como `complete`.
 */
export const respondNode = defineNode<AgentNodeName, AgentState, NodeContext, 'react' | typeof END>({
  to: ['react', END],
  async run(state, ctx) {
    const text = (state.finalText ?? '').trim() === '' ? EMPTY_ANSWER : (state.finalText as string);
    const ledger = new FactLedger(state.ledger);
    ledger.addUserText(userTextOfTurn(state.turnMessages));
    const readsImage = turnHasImage(state);
    const verification = verifyFigures(text, ledger);
    const queryParts: MessagePart[] = [...state.summaries.map((summary) => ({ type: 'query' as const, summary })), ...planParts(state.planIds), ...capabilityRequestParts(state.capabilityRequestIds), ...reportParts(state.reports)];

    // valor lido de IMAGEM (spec 036, R7): nao e fato do app; vai com o aviso "li da imagem" em vez de ser ocultado
    if (!verification.ok && readsImage) {
      const notices = [...state.notices.filter((n) => n.kind !== 'image_figures'), IMAGE_NOTICE];
      const plans = [...planParts(state.planIds), ...capabilityRequestParts(state.capabilityRequestIds), ...reportParts(state.reports)];
      const parts: MessagePart[] = [...queryParts.filter((p) => p.type === 'query'), { type: 'text', text }, ...plans, ...notices, ...appliedParts(state.appliedPreferenceIds)];
      await ctx.store.messages.update(ctx.userId, ctx.assistantMessageId, { parts, status: 'complete' });
      ctx.emit({ type: 'message_replaced', messageId: ctx.assistantMessageId, parts });
      return { next: END, state: { ...state, finalText: text, notices }, detail: { response: { masked: false, unverified: verification.mismatches.map((f) => f.raw) } } };
    }

    if (!verification.ok && state.counters.correctionAttempts === 0) {
      // O texto errado ja foi mostrado em streaming: some da tela antes da versao corrigida.
      ctx.emit({ type: 'message_replaced', messageId: ctx.assistantMessageId, parts: queryParts });
      return {
        next: 'react' as const,
        state: {
          ...state,
          finalText: null,
          turnMessages: [...state.turnMessages, { role: 'user' as const, content: [{ type: 'text' as const, text: buildCorrectionNote(state.ledger, verification.mismatches) }] }],
          counters: { ...state.counters, correctionAttempts: 1 },
        },
        detail: { response: { unverified: verification.mismatches.map((f) => f.raw) } },
      };
    }

    const masked = !verification.ok;
    const finalText = masked ? maskFigures(text, verification.mismatches) : text;
    const notices = masked ? [...state.notices, UNVERIFIED_NOTICE] : state.notices;
    const applied = appliedParts(state.appliedPreferenceIds);
    const plans = [...planParts(state.planIds), ...capabilityRequestParts(state.capabilityRequestIds), ...reportParts(state.reports)];
    const queries = queryParts.filter((p) => p.type === 'query');
    const parts: MessagePart[] = [...queries, { type: 'text', text: finalText }, ...plans, ...notices, ...applied];
    await ctx.store.messages.update(ctx.userId, ctx.assistantMessageId, { parts, status: 'complete' });
    if (masked || applied.length > 0 || plans.length > 0) {
      ctx.emit({ type: 'message_replaced', messageId: ctx.assistantMessageId, parts });
    }
    return {
      next: END,
      state: { ...state, finalText, notices },
      detail: { response: { masked, unverified: verification.mismatches.map((f) => f.raw) } },
    };
  },
});
