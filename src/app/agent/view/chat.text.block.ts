/** Trecho de texto: normal, em negrito (`**assim**`), italico (`*assim*`), codigo (`` `assim` ``) ou link (`[texto](https://...)`, so https). */
export interface ChatTextRun {
  readonly text: string;
  readonly bold: boolean;
  readonly italic?: boolean;
  readonly code?: boolean;
  /** Endereco `https://` de um link; so a tela decide abrir (no navegador externo). */
  readonly href?: string;
}

/** Bloco de uma resposta em Markdown seguro (nada de HTML): paragrafo, titulo, item de lista (com marcador), tabela ou bloco de codigo copiavel. */
export type ChatTextBlock =
  | { readonly kind: 'paragraph' | 'item'; readonly runs: readonly ChatTextRun[]; readonly marker?: string }
  | { readonly kind: 'code'; readonly text: string; readonly lang?: string }
  | { readonly kind: 'heading'; readonly level: 1 | 2 | 3; readonly runs: readonly ChatTextRun[] }
  | { readonly kind: 'table'; readonly header: readonly (readonly ChatTextRun[])[]; readonly rows: readonly (readonly (readonly ChatTextRun[])[])[] };
