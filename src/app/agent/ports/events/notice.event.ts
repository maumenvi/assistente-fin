import { type NoticePart } from '../../../../domain/agent/notice.part.ts';
import { type AgentEventBase } from './agent.event.base.ts';

/** Aviso anexado a mensagem (sem ferramentas, limite atingido, atalho para configuracoes...). */
export interface NoticeEvent extends AgentEventBase {
  readonly type: 'notice';
  readonly messageId: string;
  readonly notice: NoticePart;
}
