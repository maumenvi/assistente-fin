import { type Transaction } from '../../../../domain/transaction/transaction.entity.ts';
import { type AgentCell, TRANSACTION_COLUMNS } from '../../format/agent.payload.ts';
import { toIsoDay, toVersion } from './iso.date.ts';

/**
 * Uma transacao como linha da tabela colunar (spec 029, R6). A ordem das celulas segue
 * `TRANSACTION_COLUMNS`; `notes` fica `null` quando vazio.
 */
export function toAgentTransactionRow(transaction: Transaction): readonly AgentCell[] {
  const values: Record<(typeof TRANSACTION_COLUMNS)[number], AgentCell> = {
    id: transaction.id,
    v: toVersion(transaction.updatedAt),
    date: toIsoDay(transaction.date),
    type: transaction.type,
    amountCents: transaction.amount.cents,
    notes: transaction.notes ?? null,
    accountId: transaction.accountId,
    categoryId: transaction.categoryId,
    installmentGroupId: transaction.installmentGroupId,
    installmentNumber: transaction.installmentNumber,
    installmentTotal: transaction.installmentTotal,
  };
  return TRANSACTION_COLUMNS.map((column) => values[column]);
}
