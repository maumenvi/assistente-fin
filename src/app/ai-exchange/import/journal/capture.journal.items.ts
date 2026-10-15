import { type Database } from '../../../shared/database.port.ts';
import { type JournalItem } from '../../journal.image.ts';
import { toCategoryRecord, toFixedExpenseRecord, toIncomeRecord, toSpendingLimitRecord, toTransactionRecord } from '../../../backup/backup.record.mapper.ts';
import { type EntityRef } from './journal.refs.ts';

const version = (updatedAt: Date | null | undefined): string | null => (updatedAt === null || updatedAt === undefined ? null : updatedAt.toISOString());

/**
 * Le as entidades de `refs` e as devolve como itens do diario (registro de backup + versao),
 * pulando as que nao existem (spec 029, R4). Usado para a imagem anterior e a posterior.
 */
export async function captureJournalItems(database: Database, userId: string, refs: readonly EntityRef[]): Promise<JournalItem[]> {
  const items: JournalItem[] = [];
  const seen = new Set<string>();
  for (const ref of refs) {
    // a mesma entidade pode vir de mais de um caminho (a propria e o ganho espelho, irmas do grupo)
    const key = `${ref.entity}:${ref.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    switch (ref.entity) {
      case 'transaction': {
        const found = await database.transactions.findById(userId, ref.id);
        if (found) items.push({ entity: 'transaction', record: toTransactionRecord(found), version: version(found.updatedAt) });
        break;
      }
      case 'income': {
        const found = await database.incomes.findById(userId, ref.id);
        if (found) items.push({ entity: 'income', record: toIncomeRecord(found), version: version(found.updatedAt) });
        break;
      }
      case 'fixedExpense': {
        const found = await database.fixedExpenses.findById(userId, ref.id);
        if (found) items.push({ entity: 'fixedExpense', record: toFixedExpenseRecord(found), version: version(found.updatedAt) });
        break;
      }
      case 'spendingLimit': {
        const found = await database.spendingLimits.findById(userId, ref.id);
        if (found) items.push({ entity: 'spendingLimit', record: toSpendingLimitRecord(found), version: version(found.updatedAt) });
        break;
      }
      case 'category': {
        const found = await database.categories.findById(userId, ref.id);
        if (found) items.push({ entity: 'category', record: toCategoryRecord(found), version: null });
        break;
      }
    }
  }
  return items;
}
