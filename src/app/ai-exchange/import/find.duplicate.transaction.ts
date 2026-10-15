import { type Database } from '../../shared/database.port.ts';
import { toIsoDay } from '../export/dto/iso.date.ts';

/**
 * Chave de duplicidade do app: conta, tipo, valor e dia UTC (spec 001, CA-5; a mesma regra de
 * `TransactionRepository.findDuplicate`). `null` se os dados nao bastam para formar a chave.
 */
export function duplicateKey(data: Record<string, unknown>): string | null {
  const { accountId, type, amountCents, date } = data;
  if (typeof accountId !== 'string' || typeof type !== 'string' || typeof amountCents !== 'number' || typeof date !== 'string') return null;
  const day = new Date(date);
  if (Number.isNaN(day.getTime())) return null;
  return `${accountId}|${type}|${amountCents}|${toIsoDay(day)}`;
}

/**
 * Le as transacoes UMA vez e devolve o conjunto de chaves de duplicidade existentes (spec 029,
 * FR-005): o plano de um bloco grande nao relê o historico a cada operacao.
 */
export async function loadDuplicateKeys(database: Database, userId: string): Promise<Set<string>> {
  const keys = new Set<string>();
  for (const transaction of await database.transactions.listByUser(userId)) {
    keys.add(`${transaction.accountId}|${transaction.type}|${transaction.amount.cents}|${toIsoDay(transaction.date)}`);
  }
  return keys;
}
