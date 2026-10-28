import { type MessagePart } from '../../../domain/agent/message.part.ts';
import { type AgentEvent } from '../ports/events/agent.event.ts';
import { activityLabel } from './activity.label.ts';
import { bannerOfError } from './banner.of.error.ts';
import { type ChatViewState } from './chat.view.state.ts';
import { type ViewMessage } from './view.message.ts';

function mapMessage(state: ChatViewState, id: string, change: (message: ViewMessage) => ViewMessage): ChatViewState {
  if (!state.messages.some((m) => m.id === id)) return state;
  return { ...state, messages: state.messages.map((m) => (m.id === id ? change(m) : m)) };
}

function appendText(parts: readonly MessagePart[], text: string): readonly MessagePart[] {
  const index = parts.findIndex((p) => p.type === 'text');
  if (index === -1) {
    // o texto vem antes do cartao do plano e dos avisos
    const firstAfter = parts.findIndex((p) => p.type === 'notice' || p.type === 'plan' || p.type === 'capability_request' || p.type === 'report_saved');
    const at = firstAfter === -1 ? parts.length : firstAfter;
    return [...parts.slice(0, at), { type: 'text', text }, ...parts.slice(at)];
  }
  return parts.map((p, i) => (i === index && p.type === 'text' ? { ...p, text: p.text + text } : p));
}

function insertQuery(parts: readonly MessagePart[], part: MessagePart): readonly MessagePart[] {
  const firstOther = parts.findIndex((p) => p.type !== 'query');
  const at = firstOther === -1 ? parts.length : firstOther;
  return [...parts.slice(0, at), part, ...parts.slice(at)];
}

/** Aplica um evento do agente ao estado da conversa (puro). Evento repetido ou atrasado e ignorado. */
export function reduceChat(state: ChatViewState, event: AgentEvent): ChatViewState {
  if (state.conversationId !== null && event.conversationId !== state.conversationId) return state;
  if (state.lastEvent !== null && state.lastEvent.runId === event.runId && event.seq <= state.lastEvent.seq) return state;
  const next: ChatViewState = { ...state, lastEvent: { runId: event.runId, seq: event.seq } };

  switch (event.type) {
    case 'run_started': {
      const exists = next.messages.some((m) => m.id === event.assistantMessageId);
      const assistant: ViewMessage = { id: event.assistantMessageId, role: 'assistant', parts: [], status: 'streaming', errorCode: null, seq: null, runId: event.runId };
      return {
        ...next,
        conversationId: event.conversationId,
        messages: exists ? next.messages : [...next.messages, assistant],
        activeRun: { runId: event.runId, node: null, label: activityLabel(null), stoppable: true },
        canRetryLast: false,
        banner: null,
      };
    }
    case 'node_started':
      return next.activeRun === null || next.activeRun.runId !== event.runId
        ? next
        : { ...next, activeRun: { ...next.activeRun, node: event.node, label: activityLabel(event.node) } };
    case 'text_delta':
      return mapMessage(next, event.messageId, (m) => ({ ...m, parts: appendText(m.parts, event.text), status: 'streaming' }));
    case 'query_card':
      return mapMessage(next, event.messageId, (m) => ({ ...m, parts: insertQuery(m.parts, { type: 'query', summary: event.summary }) }));
    case 'notice':
      return mapMessage(next, event.messageId, (m) => ({
        ...m,
        parts: m.parts.some((p) => p.type === 'notice' && p.kind === event.notice.kind) ? m.parts : [...m.parts, event.notice],
      }));
    case 'preference_suggested':
      return mapMessage(next, event.messageId, (m) => ({
        ...m,
        parts: m.parts.some((p) => p.type === 'suggestion' && p.preferenceId === event.preferenceId)
          ? m.parts
          : [...m.parts, { type: 'suggestion' as const, preferenceId: event.preferenceId, text: event.text, state: 'open' as const }],
      }));
    case 'plan_updated':
      return mapMessage(next, event.messageId, (m) => {
        if (m.parts.some((p) => p.type === 'plan' && p.planId === event.planId)) return m;
        const firstNotice = m.parts.findIndex((p) => p.type === 'notice');
        const at = firstNotice === -1 ? m.parts.length : firstNotice;
        return { ...m, parts: [...m.parts.slice(0, at), { type: 'plan' as const, planId: event.planId }, ...m.parts.slice(at)] };
      });
    case 'capability_requested':
      return mapMessage(next, event.messageId, (m) => {
        if (m.parts.some((p) => p.type === 'capability_request' && p.requestId === event.requestId)) return m;
        const firstNotice = m.parts.findIndex((p) => p.type === 'notice');
        const at = firstNotice === -1 ? m.parts.length : firstNotice;
        return { ...m, parts: [...m.parts.slice(0, at), { type: 'capability_request' as const, requestId: event.requestId }, ...m.parts.slice(at)] };
      });
    case 'report_saved':
      return mapMessage(next, event.messageId, (m) => {
        if (m.parts.some((p) => p.type === 'report_saved' && p.path === event.path)) return m;
        const firstNotice = m.parts.findIndex((p) => p.type === 'notice');
        const at = firstNotice === -1 ? m.parts.length : firstNotice;
        return { ...m, parts: [...m.parts.slice(0, at), { type: 'report_saved' as const, path: event.path, format: event.format }, ...m.parts.slice(at)] };
      });
    case 'folder_permission_requested':
      return next.fileRequests.some((r) => r.requestId === event.requestId)
        ? next
        : { ...next, fileRequests: [...next.fileRequests, { kind: 'folder', requestId: event.requestId, path: event.path, access: event.access, missing: event.missing }] };
    case 'file_edit_confirmation_requested':
      return next.fileRequests.some((r) => r.requestId === event.requestId)
        ? next
        : { ...next, fileRequests: [...next.fileRequests, { kind: 'edit', requestId: event.requestId, path: event.path, preview: event.preview }] };
    case 'file_request_resolved':
      return { ...next, fileRequests: next.fileRequests.filter((r) => r.requestId !== event.requestId) };
    case 'summary_updated': {
      const marker = { type: 'summary_marker' as const, summaryId: event.summaryId, coveredFromSeq: event.coveredFromSeq, coveredToSeq: event.coveredToSeq };
      return {
        ...next,
        messages: next.messages.map((m) => {
          const kept = m.parts.filter((p) => p.type !== 'summary_marker');
          return m.id === event.messageId ? { ...m, parts: [...kept, marker] } : kept.length === m.parts.length ? m : { ...m, parts: kept };
        }),
      };
    }
    case 'message_replaced':
      return mapMessage(next, event.messageId, (m) => ({ ...m, parts: event.parts }));
    case 'run_finished': {
      const assistantId = next.messages.findLast((m) => m.role === 'assistant')?.id ?? null;
      const status = event.status === 'done' ? 'complete' : event.status === 'failed' ? 'error' : 'interrupted';
      const settled =
        assistantId === null
          ? next
          : mapMessage(next, assistantId, (m) => ({ ...m, status, errorCode: event.error?.code ?? null }));
      return {
        ...settled,
        activeRun: null,
        fileRequests: [],
        canRetryLast: event.status !== 'done',
        banner: event.status === 'failed' ? bannerOfError(event.error?.code) : settled.banner,
      };
    }
    default:
      return next;
  }
}
