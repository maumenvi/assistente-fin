import { type Database } from '../shared/database.port.ts';

/**
 * Apaga todo o dado financeiro de um usuario (spec 002, RF-38) - passo 1 de
 * `RestoreDataSnapshot`, antes de reimportar o snapshot. Nao toca `User` nem
 * `VerificationCode`.
 *
 * Ordem: filhos de `Account` primeiro (`simulation`/`transaction`/`fixedExpense`), depois
 * `spendingLimit` (filho de `spendingLimitPlan` via `definitionId`, spec 016) antes do
 * proprio `spendingLimitPlan`, depois `income`, depois `account` - respeita as FKs
 * `RESTRICT`/`NoAction` do Postgres. Deve rodar dentro de `Database.transaction()`.
 */
export async function wipeUserFinancialData(tx: Database, userId: string): Promise<void> {
  for (const simulation of await tx.simulations.listByUser(userId)) {
    await tx.simulations.delete(userId, simulation.id);
  }
  for (const transaction of await tx.transactions.listByUser(userId)) {
    await tx.transactions.delete(userId, transaction.id);
  }
  for (const fixedExpense of await tx.fixedExpenses.listByUser(userId)) {
    await tx.fixedExpenses.delete(userId, fixedExpense.id);
  }
  for (const spendingLimit of await tx.spendingLimits.listByUser(userId)) {
    await tx.spendingLimits.delete(userId, spendingLimit.id);
  }
  for (const plan of await tx.spendingLimitPlans.listByUser(userId)) {
    await tx.spendingLimitPlans.delete(userId, plan.id);
  }
  for (const income of await tx.incomes.listByUser(userId)) {
    await tx.incomes.delete(userId, income.id);
  }
  for (const account of await tx.accounts.listByUser(userId)) {
    await tx.accounts.delete(userId, account.id);
  }
}
