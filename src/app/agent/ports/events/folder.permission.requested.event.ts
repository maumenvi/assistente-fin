import { type FolderAccess } from '../../../../domain/agent/folder/folder.access.ts';
import { type AgentEventBase } from './agent.event.base.ts';

/** O agente precisa de uma pasta que a pessoa ainda nao liberou (spec 040): o chat mostra o cartao de permissao. */
export interface FolderPermissionRequestedEvent extends AgentEventBase {
  readonly type: 'folder_permission_requested';
  readonly requestId: string;
  /** Pasta que sera liberada (nao o arquivo). */
  readonly path: string;
  readonly access: FolderAccess;
  /** A pasta nao existe para o app (ex.: Flatpak isolado): a pessoa deve escolher a pasta pelo seletor. */
  readonly missing: boolean;
}
