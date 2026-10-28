/** Uma aba (xlsx), a tabela de um csv ou uma tabela deduzida de PDF. Valores como texto; `numericTotals` e calculado pelo app. */
export interface ExtractedSheet {
  readonly name: string;
  readonly header: readonly string[];
  readonly rows: readonly (readonly string[])[];
  /** Linhas lidas (pode ser menor que o total do arquivo quando cortado). */
  readonly rowCount: number;
  /** Linhas totais do arquivo (igual a `rowCount` quando nao cortou). */
  readonly totalRows: number;
  /** Soma por coluna numerica (indice da coluna -> soma), calculada localmente pelo app. */
  readonly numericTotals: Readonly<Record<number, number>>;
}
