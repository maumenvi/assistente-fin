import { type Income } from '../../../../domain/income/income.entity.ts';
import { type AgentIncomeItem } from '../../format/agent.payload.ts';
import { toIsoDay, toVersion } from './iso.date.ts';

/** Ganho no formato do agente. */
export function toAgentIncome(income: Income): AgentIncomeItem {
  return {
    id: income.id,
    v: toVersion(income.updatedAt),
    source: income.source,
    date: toIsoDay(income.date),
    amountCents: income.amount.cents,
    recurrence: income.recurrence.frequency,
    categoryId: income.categoryId,
    accountId: income.accountId ?? null,
  };
}
