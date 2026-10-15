import { cardRow, spendingLimitRow, type LimitUsageInput } from './build.limit.usage.rows.ts';
import { type LimitsWidgetData } from './limits.widget.data.ts';
import { type LimitsWidgetPreferences } from './limits.widget.preferences.ts';

/**
 * Monta o widget de limites (spec 023, FR-001/FR-003/FR-005): limites de gasto do mes primeiro,
 * sem os escondidos, do mais para o menos usado (empate: nome); depois so os cartoes escolhidos
 * que existem, estao ativos e tem limite. Mesmo calculo de % da tela Inicio (SC-005).
 */
export function buildLimitsWidgetData(input: LimitUsageInput & { readonly preferences: LimitsWidgetPreferences }): LimitsWidgetData {
  const hidden = new Set(input.preferences.hiddenCategoryIds);
  const visibleCards = new Set(input.preferences.visibleCardIds);
  const categoryName = new Map(input.categories.map((category) => [category.id, category.name.value]));
  const spendingLimits = input.limits
    .filter((usage) => usage.limit.period.equals(input.month) && !hidden.has(usage.limit.categoryId))
    .map((usage) => spendingLimitRow(usage, categoryName))
    .sort((a, b) => b.usedPercent - a.usedPercent || a.name.localeCompare(b.name, 'pt-BR'));
  const cards = input.cards
    .filter(({ account }) => visibleCards.has(account.id) && account.kind === 'credit-card' && account.creditLimit !== null && !account.archived)
    .map(({ account, availableCents }) => cardRow(account, availableCents));
  return { month: { year: input.month.year, month: input.month.month }, spendingLimits, cards };
}
