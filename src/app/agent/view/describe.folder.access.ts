import { type FolderAccess } from '../../../domain/agent/folder/folder.access.ts';

/** O que o assistente quer fazer na pasta, em pt-BR, para o cartao de permissao do chat (spec 040). */
export function describeFolderAccess(access: FolderAccess): string {
  switch (access) {
    case 'read':
      return 'procurar e ler arquivos';
    case 'create':
      return 'criar arquivos';
    case 'edit':
      return 'ler e editar arquivos';
  }
}
