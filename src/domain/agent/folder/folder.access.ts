/** O que o assistente pode fazer numa pasta; `edit` implica `read` (spec 040, data-model). */
export type FolderAccess = 'read' | 'create' | 'edit';

/** A concessao `granted` cobre o acesso `needed`? */
export function accessCovers(granted: readonly FolderAccess[], needed: FolderAccess): boolean {
  if (granted.includes(needed)) return true;
  return needed === 'read' && granted.includes('edit');
}
