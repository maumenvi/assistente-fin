import { type MessagePart } from '../../../../domain/agent/message.part.ts';
import { type NoticePart } from '../../../../domain/agent/notice.part.ts';
import { FactLedger } from '../../verify/fact.ledger.ts';
import { maskFigures } from '../../verify/mask.figures.ts';
import { verifyFigures } from '../../verify/verify.figures.ts';
import { type AgentState } from '../agent.state.ts';
import { type LimitReason } from '../graph.ts';
import { type NodeContext } from '../node.context.ts';
import { capabilityRequestParts } from './capability.request.parts.ts';
import { reportParts } from './report.parts.ts';
import { planParts } from './plan.parts.ts';
import { userTextOfTurn } from './user.text.of.turn.ts';

const REASON_TEXT: Readonly<Record<LimitReason, string>> = {
  steps: 'Parei por atingir o limite de passos desta resposta.',
  time: 'Parei por atingir o limite de tempo desta resposta.',
  cost: 'Parei por atingir o limite de custo desta resposta.',
  tokens: 'Parei por atingir o limite de tokens desta resposta.',
};

const EXTEND_QUESTION = 'Quer estender o limite para eu continuar?';
const NOTHING_YET = `Não consegui concluir a consulta antes do limite. ${EXTEND_QUESTION}`;

function buildBudgetReasonText(which: LimitReason, state: AgentState): string {
  const base = REASON_TEXT[which];
  const missing =
    state.pendingToolCalls.length > 0
      ? ` Faltou concluir: ${state.pendingToolCalls.map((c) => c.name).join(', ')}.`
      : '';
  return `${base}${missing} ${EXTEND_QUESTION}`;
}

/** Ultimo texto escrito pelo assistente na rodada (o "parcial" do `react`). */
function lastAssistantText(state: AgentState): string {
  for (let i = state.turnMessages.length - 1; i >= 0; i -= 1) {
    const message = state.turnMessages[i];
    if (message?.role !== 'assistant') continue;
    const text = message.content.map((p) => (p.type === 'text' ? p.text : '')).join('').trim();
    if (text !== '') return text;
  }
  return '';
}

/**
 * `onLimit` do grafo (spec 031, T073, FR-017): ao estourar passos, tempo ou custo, entrega o que ja
 * foi apurado - texto parcial do `react` e cartoes "Consultei" ja emitidos -, acrescenta o aviso
 * `budget_reached` com o motivo e mascara qualquer valor sem fato (nao ha segunda chance aqui).
 * A execucao termina `done`.
 */
export async function partialAnswer(state: AgentState, which: LimitReason, ctx: NodeContext): Promise<AgentState> {
  const raw = state.finalText?.trim() || lastAssistantText(state) || NOTHING_YET;
  const ledger = new FactLedger(state.ledger);
  ledger.addUserText(userTextOfTurn(state.turnMessages));
  const verification = verifyFigures(raw, ledger);
  const text = verification.ok ? raw : maskFigures(raw, verification.mismatches);
  const notices: NoticePart[] = [...state.notices];
  if (!verification.ok) {
    notices.push({ type: 'notice', kind: 'figures_unverified', text: 'Alguns valores da resposta não puderam ser confirmados nos seus dados e foram ocultados.' });
  }
  notices.push({ type: 'notice', kind: 'budget_reached', text: buildBudgetReasonText(which, state) });
  const parts: MessagePart[] = [...state.summaries.map((summary) => ({ type: 'query' as const, summary })), { type: 'text', text }, ...planParts(state.planIds), ...capabilityRequestParts(state.capabilityRequestIds), ...reportParts(state.reports), ...notices];
  await ctx.store.messages.update(ctx.userId, ctx.assistantMessageId, { parts, status: 'complete' });
  ctx.emit({ type: 'message_replaced', messageId: ctx.assistantMessageId, parts });
  return { ...state, finalText: text, notices };
}
