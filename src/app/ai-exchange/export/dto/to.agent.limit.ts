import { type SpendingLimit } from '../../../../domain/spending-limit/spending.limit.entity.ts';
import { type AgentLimitItem } from '../../format/agent.payload.ts';
import { toVersion } from './iso.date.ts';

/** Limite de gasto do mes no formato do agente. */
export function toAgentLimit(limit: SpendingLimit): AgentLimitItem {
  return {
    id: limit.id,
    v: toVersion(limit.updatedAt),
    categoryId: limit.categoryId,
    year: limit.period.year,
    month: limit.period.month,
    maxAmountCents: limit.maxAmount.cents,
  };
}
