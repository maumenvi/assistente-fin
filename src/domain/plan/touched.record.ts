/** Registro serializado pelos codecs de sync/backup (a camada app conhece o formato). */
export type RecordSnapshot = Readonly<Record<string, unknown>>;

/** Registro tocado por uma aplicacao: com `before`/`after` o desfazer e generico (data-model.md 4). */
export interface TouchedRecord {
  readonly entity: 'transaction' | 'category' | 'income' | 'fixedExpense';
  readonly id: string;
  readonly before: RecordSnapshot | null;
  readonly after: RecordSnapshot | null;
}
