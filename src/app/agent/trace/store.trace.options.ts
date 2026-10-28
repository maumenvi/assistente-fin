/** Ajustes do `StoreTrace` (spec 031, D16). */
export interface StoreTraceOptions {
  /** Maximo de eventos em fila; ao estourar, descarta o mais antigo (padrao 500). */
  readonly maxQueue?: number;
  /** Tamanho do lote que dispara a gravacao na hora (padrao 50). */
  readonly batchSize?: number;
  /** Espera maxima antes de gravar um lote parcial, em ms (padrao 250). */
  readonly flushIntervalMs?: number;
  /** Agendador injetavel (testes); devolve a funcao que cancela. */
  readonly schedule?: (work: () => void, ms: number) => () => void;
}
