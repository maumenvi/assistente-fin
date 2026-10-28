/** Um item achado na busca de arquivos. */
export interface FileEntry {
  readonly path: string;
  readonly size: number;
  readonly modifiedAt: string;
}

export interface SearchFilesOptions {
  /** Trecho do nome do arquivo (sem diferenciar maiusculas). */
  readonly query?: string | undefined;
  /** Padrao simples com `*` e `?` aplicado ao nome do arquivo. */
  readonly glob?: string | undefined;
  readonly maxResults: number;
}

/**
 * Acesso ao disco do computador (so desktop; spec 040). A porta NAO decide permissao: quem chama (as
 * ferramentas, via `FileGate`) ja garantiu que o caminho esta numa pasta autorizada.
 */
export interface FileAccessPort {
  /** Caminho real (links simbolicos resolvidos). Para um caminho que ainda nao existe, resolve o ancestral existente. */
  realpath(path: string): Promise<string>;
  isDirectory(path: string): Promise<boolean>;
  /** O caminho existe (pasta ou arquivo)? */
  exists(path: string): Promise<boolean>;
  /** Busca por nome, sem seguir links simbolicos para fora da raiz; profundidade e quantidade limitadas. */
  search(root: string, options: SearchFilesOptions): Promise<{ readonly entries: readonly FileEntry[]; readonly truncated: boolean }>;
  /** Le o arquivo; passa de `maxBytes` => `FileTooLargeError`. */
  read(path: string, maxBytes: number): Promise<Uint8Array>;
  /** Cria o arquivo sem NUNCA sobrescrever: nome existente ganha sufixo `-2`, `-3`. Devolve o caminho gravado. */
  create(path: string, content: string): Promise<string>;
  /** Substitui o conteudo de um arquivo que ja existe. */
  write(path: string, content: string): Promise<void>;
}
