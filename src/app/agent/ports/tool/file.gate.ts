import { type FileEditPreview } from '../../../../domain/agent/folder/file.edit.preview.ts';
import { type FolderAccess } from '../../../../domain/agent/folder/folder.access.ts';

/**
 * Porta das ferramentas de arquivo para a PESSOA (spec 040): garante a concessao da pasta (perguntando no chat se faltar)
 * e pede a confirmacao de uma edicao. So o app cria a porta; o modelo nunca a enxerga.
 */
export interface FileGate {
  /**
   * Devolve o caminho real autorizado para o `access`. Lanca `FolderAccessDeniedError` se a pessoa negar (ou o caminho for
   * proibido) e `PathOutsideGrantError` para `..`. Sem concessao, entra em espera e pergunta no chat.
   */
  ensure(path: string, access: FolderAccess): Promise<string>;
  /**
   * Mostra no chat o cartao "escolha uma pasta" (sem caminho): a pessoa escolhe no seletor do sistema e a pasta fica liberada
   * (`read` = so leitura; demais = ler, criar e editar). Devolve o caminho liberado; negar lanca `FolderAccessDeniedError`.
   */
  requestFolder(access: FolderAccess): Promise<string>;
  /** Mostra a previa no chat e espera a decisao; `true` = pode gravar. */
  confirmEdit(path: string, preview: FileEditPreview): Promise<boolean>;
}
