import { type Database } from '../../../shared/database.port.ts';
import { type JournalItem, type JournalEntity } from '../../journal.image.ts';
import {
  fromCategoryRecord,
  fromFixedExpenseRecord,
  fromIncomeRecord,
  fromSpendingLimitRecord,
  fromTransactionRecord,
} from '../../../backup/backup.record.mapper.ts';
import {
  type BackupCategoryRecord,
  type BackupFixedExpenseRecord,
  type BackupIncomeRecord,
  type BackupSpendingLimitRecord,
  type BackupTransactionRecord,
} from '../../../shared/backup.record.schema.ts';
import { journalItemId } from './journal.item.id.ts';

/** Ordem de gravacao ao restaurar: o que e referenciado vem antes de quem referencia. */
const RESTORE_ORDER: readonly JournalEntity[] = ['category', 'income', 'fixedExpense', 'spendingLimit', 'transaction'];

/** Grava de volta os itens do diario (spec 029, R4): cada registro passa por `Entity.fromPersistence`. */
export async function restoreJournalItems(database: Database, userId: string, items: readonly JournalItem[]): Promise<void> {
  for (const entity of RESTORE_ORDER) {
    for (const item of items.filter((candidate) => candidate.entity === entity)) {
      switch (item.entity) {
        case 'category':
          await database.categories.save(fromCategoryRecord(item.record as BackupCategoryRecord));
          break;
        case 'income':
          await database.incomes.save(fromIncomeRecord(item.record as BackupIncomeRecord));
          break;
        case 'fixedExpense':
          await database.fixedExpenses.save(fromFixedExpenseRecord(item.record as BackupFixedExpenseRecord));
          break;
        case 'spendingLimit':
          await database.spendingLimits.save(fromSpendingLimitRecord(item.record as BackupSpendingLimitRecord));
          break;
        case 'transaction':
          await database.transactions.save(fromTransactionRecord(item.record as BackupTransactionRecord));
          break;
      }
    }
  }
  void userId;
}

/** Apaga as entidades dos itens (desfazer de uma criacao), as que referenciam primeiro. */
export async function deleteJournalItems(database: Database, userId: string, items: readonly JournalItem[]): Promise<void> {
  for (const entity of [...RESTORE_ORDER].reverse()) {
    for (const item of items.filter((candidate) => candidate.entity === entity)) {
      const id = journalItemId(item);
      switch (item.entity) {
        case 'category':
          // categorias nao tem exclusao no repositorio na v1: o desfazer so as mantem
          break;
        case 'income':
          await database.incomes.delete(userId, id);
          break;
        case 'fixedExpense':
          await database.fixedExpenses.delete(userId, id);
          break;
        case 'spendingLimit':
          await database.spendingLimits.delete(userId, id);
          break;
        case 'transaction':
          await database.transactions.delete(userId, id);
          break;
      }
    }
  }
}
