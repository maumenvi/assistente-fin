import { type Database } from '../../../shared/database.port.ts';
import { type JournalItem } from '../../journal.image.ts';
import { captureJournalItems } from './capture.journal.items.ts';
import { journalItemId, journalItemKey } from './journal.item.id.ts';

const sameVersion = (a: string | null, b: string | null): boolean => (a === null || b === null ? a === b : new Date(a).getTime() === new Date(b).getTime());

/**
 * O diario ainda descreve a realidade? (spec 029, R4): o que a operacao deixou (`after`) tem de estar
 * como foi gravado, e o que ela apagou (so em `before`) nao pode ter sido recriado. Devolve os ids que
 * mudaram depois do lote, ou lista vazia quando e seguro desfazer.
 */
export async function detectUndoConflicts(
  database: Database,
  userId: string,
  before: readonly JournalItem[],
  after: readonly JournalItem[],
): Promise<string[]> {
  const conflicts: string[] = [];
  const beforeKeys = new Set(before.map(journalItemKey));
  for (const item of after) {
    if (item.entity === 'category') continue;
    const [current] = await captureJournalItems(database, userId, [{ entity: item.entity, id: journalItemId(item) }]);
    if (current === undefined || !sameVersion(current.version, item.version)) conflicts.push(journalItemId(item));
  }
  const afterKeys = new Set(after.map(journalItemKey));
  for (const item of before) {
    if (afterKeys.has(journalItemKey(item)) || item.entity === 'category') continue;
    const [current] = await captureJournalItems(database, userId, [{ entity: item.entity, id: journalItemId(item) }]);
    if (current !== undefined) conflicts.push(journalItemId(item));
  }
  void beforeKeys;
  return conflicts;
}
