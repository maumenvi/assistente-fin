import { type Database } from '../../../shared/database.port.ts';
import { type EntityRef } from '../journal/journal.refs.ts';

/** Um gasto fixo e o lancamento que ele gera ao ser pago (`fixedExpenseId`), se houver. */
export async function fixedExpenseRefs(database: Database, userId: string, id: string): Promise<EntityRef[]> {
  const refs: EntityRef[] = [{ entity: 'fixedExpense', id }];
  const linked = await database.transactions.findByFixedExpenseId(userId, id);
  if (linked !== null) refs.push({ entity: 'transaction', id: linked.id });
  return refs;
}
