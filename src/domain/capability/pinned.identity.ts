/** Ferramenta fixada: nome e hashes da descricao e do schema (detectam descricao envenenada depois da aprovacao). */
export interface PinnedTool {
  readonly name: string;
  readonly descriptionHash: string;
  readonly schemaHash: string;
}

/** Arquivo de skill fixado. */
export interface PinnedFile {
  readonly path: string;
  readonly sha256: string;
  readonly bytes: number;
}

/** Identidade fixada na aprovacao (data-model.md 1): servidor MCP (ferramentas) ou skill (arquivos). */
export interface PinnedIdentity {
  readonly hash: string;
  readonly tools: readonly PinnedTool[];
  readonly files: readonly PinnedFile[];
  readonly serverName?: string | undefined;
  readonly serverVersion?: string | undefined;
  readonly pinnedAt: string;
}
