import { type Month } from '../../domain/shared/month.value.object.ts';
import { type Account } from '../../domain/account/account.entity.ts';
import { type Category } from '../../domain/category/category.entity.ts';
import { type SpendingLimitUsage } from './list.spending.limits.with.usage.use.case.ts';
import { type LimitUsageRow } from './limit.usage.row.ts';
import { usagePercent } from './usage.percent.ts';
import { usageStatus } from './usage.status.ts';

/** Entrada comum as linhas do Inicio e do widget. */
export interface LimitUsageInput {
  readonly month: Month;
  readonly limits: readonly SpendingLimitUsage[];
  readonly categories: readonly Category[];
  readonly cards: readonly { readonly account: Account; readonly availableCents: number }[];
}

/** Linha de um limite de gasto. */
export function spendingLimitRow(usage: SpendingLimitUsage, categoryName: ReadonlyMap<string, string>): LimitUsageRow {
  const usedPercent = usagePercent(usage.spent.cents, usage.limit.maxAmount.cents);
  return { id: usage.limit.id, name: categoryName.get(usage.limit.categoryId) ?? '', kind: 'spending-limit', usedPercent, status: usageStatus(usedPercent) };
}

/** Linha de um cartao (limite comprometido, spec 014). */
export function cardRow(account: Account, availableCents: number): LimitUsageRow {
  const limit = account.creditLimit?.cents ?? 0;
  const usedPercent = usagePercent(limit - availableCents, limit);
  return { id: account.id, name: account.name, kind: 'credit-card', usedPercent, status: usageStatus(usedPercent) };
}

/**
 * Linhas de "% usado" da tela Inicio (spec 022, FR-045): todos os cartoes com limite e os limites
 * de gasto do mes. So percentuais, nunca valores absolutos (FR-047).
 */
export function buildLimitUsageRows(input: LimitUsageInput): LimitUsageRow[] {
  const categoryName = new Map(input.categories.map((category) => [category.id, category.name.value]));
  const limitRows = input.limits.filter((usage) => usage.limit.period.equals(input.month)).map((usage) => spendingLimitRow(usage, categoryName));
  const cards = input.cards.filter(({ account }) => account.creditLimit !== null && !account.archived).map(({ account, availableCents }) => cardRow(account, availableCents));
  return [...cards, ...limitRows];
}
