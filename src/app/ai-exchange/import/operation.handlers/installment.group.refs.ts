import { type Database } from '../../../shared/database.port.ts';
import { type EntityRef } from '../journal/journal.refs.ts';

/** Todas as parcelas do grupo de uma parcela de referencia (ela mesma se nao for parcelada). */
export async function installmentGroupRefs(database: Database, userId: string, referenceId: string): Promise<EntityRef[]> {
  const reference = await database.transactions.findById(userId, referenceId);
  if (reference === null) return [];
  if (reference.installmentGroupId === null) return [{ entity: 'transaction', id: reference.id }];
  const group = await database.transactions.listByInstallmentGroup(userId, reference.installmentGroupId);
  return group.map((member) => ({ entity: 'transaction' as const, id: member.id }));
}
