import { type AgentEventBase } from './agent.event.base.ts';

/** `write_report` gravou um arquivo (spec 040): a UI mostra o cartao com a acao "Abrir". */
export interface ReportSavedEvent extends AgentEventBase {
  readonly type: 'report_saved';
  readonly messageId: string;
  readonly path: string;
  readonly format: 'md' | 'html';
}
