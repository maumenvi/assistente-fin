import { type FileEditPreview } from '../../../../domain/agent/folder/file.edit.preview.ts';
import { type AgentEventBase } from './agent.event.base.ts';

/** Edicao numa pasta sem git: o chat mostra a previa e espera a pessoa aprovar (spec 040, FR-012). */
export interface FileEditConfirmationRequestedEvent extends AgentEventBase {
  readonly type: 'file_edit_confirmation_requested';
  readonly requestId: string;
  readonly path: string;
  readonly preview: FileEditPreview;
}
