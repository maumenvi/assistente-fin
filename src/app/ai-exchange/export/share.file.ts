/** Arquivo que o app entrega ao compartilhamento do sistema (spec 029, contracts/agent.payload.format.md §3). */
export interface ShareFile {
  /** Nome sem acento, sem espacos. */
  readonly name: string;
  readonly mimeType: 'application/json' | 'text/markdown' | 'text/plain';
  readonly content: string;
}
