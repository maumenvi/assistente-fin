import { type FolderAccess } from '../../../domain/agent/folder/folder.access.ts';

/** O que uma pasta liberada permite, em duas palavras para quem nao e tecnico (spec 040). */
export function describeGrantAccess(access: readonly FolderAccess[]): string {
  return access.includes('create') || access.includes('edit') ? 'leitura e gravação' : 'somente leitura';
}
