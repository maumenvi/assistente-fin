import { Account } from '../../../src/domain/account/account.entity.ts';
import { Money } from '../../../src/domain/shared/money.value.object.ts';
import { toAccountRecord } from '../../../src/app/backup/backup.record.mapper.ts';
import { type SyncOp } from '../../../src/app/sync/sync.op.ts';

/** Conta de exemplo para os testes de sync. */
export function account(id: string, name = 'Itau', userId = 'u1'): Account {
  return Account.create({ id, userId, name, kind: 'checking', openingBalance: Money.zero() });
}

/** Operacao de upsert de conta. */
export function upsertAccount(opId: string, id: string, name: string, baseVersion: string | null, userId = 'u1'): SyncOp {
  return { opId, entity: 'account', entityId: id, kind: 'upsert', baseVersion, record: toAccountRecord(account(id, name, userId)) };
}

/** Operacao de exclusao de conta. */
export function deleteAccount(opId: string, id: string, baseVersion: string | null): SyncOp {
  return { opId, entity: 'account', entityId: id, kind: 'delete', baseVersion, record: null };
}
