import { type FolderAccess } from '../../../domain/agent/folder/folder.access.ts';
import { type FolderDecision } from './folder.decision.ts';
import { type GateScope } from './gate.scope.ts';

/** Pedido a espera da pessoa: de pasta (`folder`) ou de confirmacao de edicao (`edit`). */
export type PendingRequest = { readonly requestId: string; readonly scope: GateScope } & (
  | { readonly kind: 'folder'; readonly folder: string; readonly access: FolderAccess; settle(decision: FolderDecision, pickedPath: string | null): void }
  | { readonly kind: 'edit'; settle(approve: boolean): void }
);
