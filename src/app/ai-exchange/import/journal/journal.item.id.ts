import { type JournalItem } from '../../journal.image.ts';

/** Id da entidade de um item do diario (todo registro de backup tem `id`). */
export function journalItemId(item: JournalItem): string {
  return (item.record as { id: string }).id;
}

/** Chave unica `entidade:id`, para comparar imagens. */
export function journalItemKey(item: JournalItem): string {
  return `${item.entity}:${journalItemId(item)}`;
}
