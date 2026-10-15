import { type FixedExpense } from '../../../../domain/fixed-expense/fixed.expense.entity.ts';
import { type AgentFixedExpenseItem } from '../../format/agent.payload.ts';
import { toVersion } from './iso.date.ts';

/** Gasto fixo no formato do agente. */
export function toAgentFixedExpense(fixedExpense: FixedExpense): AgentFixedExpenseItem {
  return {
    id: fixedExpense.id,
    v: toVersion(fixedExpense.updatedAt),
    description: fixedExpense.description,
    dueDay: fixedExpense.dueDay,
    expectedAmountCents: fixedExpense.expectedAmount.cents,
    categoryId: fixedExpense.categoryId,
    accountId: fixedExpense.accountId,
    paid: fixedExpense.paid,
  };
}
