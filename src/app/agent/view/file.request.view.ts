import { type FileEditPreview } from '../../../domain/agent/folder/file.edit.preview.ts';
import { type FolderAccess } from '../../../domain/agent/folder/folder.access.ts';

/** Cartao de permissao no chat (spec 040): pasta a liberar ou edicao a aprovar; some quando a decisao e tomada. */
export type FileRequestView =
  | { readonly kind: 'folder'; readonly requestId: string; readonly path: string; readonly access: FolderAccess; readonly missing: boolean }
  | { readonly kind: 'edit'; readonly requestId: string; readonly path: string; readonly preview: FileEditPreview };
