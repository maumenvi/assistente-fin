/** Entidades que o diario sabe guardar e restaurar (spec 029, R4). */
export type JournalEntity = 'transaction' | 'income' | 'fixedExpense' | 'spendingLimit' | 'category';

/** Uma entidade no diario: o registro de backup e a versao (`updatedAt` ISO) no instante da imagem. */
export interface JournalItem {
  readonly entity: JournalEntity;
  /** Registro de backup da entidade (`toXRecord`); restaurado com `fromXRecord`. */
  readonly record: unknown;
  readonly version: string | null;
}

/**
 * Imagem de uma operacao no diario (spec 029, R4): todas as entidades que ela tocou, inclusive os
 * efeitos colaterais (o ganho espelho de um lancamento de entrada, as demais parcelas de uma
 * compra parcelada). O desfazer restaura cada item.
 */
export interface JournalImage {
  readonly items: readonly JournalItem[];
}

export const EMPTY_JOURNAL_IMAGE: JournalImage = { items: [] };
