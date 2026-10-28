/** Aviso da extracao: conteudo cortado por limite, celulas ilegiveis, PDF sem texto ou tabela deduzida pela posicao. */
export interface ContentWarning {
  readonly code: 'truncated' | 'unreadable_cells' | 'no_text' | 'tables_guessed';
  readonly detail?: Readonly<Record<string, string | number>>;
}
