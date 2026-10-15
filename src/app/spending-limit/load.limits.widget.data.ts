import { Month } from '../../domain/shared/month.value.object.ts';
import { type Account } from '../../domain/account/account.entity.ts';
import { type Category } from '../../domain/category/category.entity.ts';
import { type Money } from '../../domain/shared/money.value.object.ts';
import { type SpendingLimitUsage } from './list.spending.limits.with.usage.use.case.ts';
import { buildLimitsWidgetData } from './build.limits.widget.data.ts';
import { type LimitsWidgetData } from './limits.widget.data.ts';
import { type LimitsWidgetPreferences } from './limits.widget.preferences.ts';

/** Casos de uso que o widget de limites consulta (os mesmos do app). */
export interface LimitsWidgetSources {
  readonly listSpendingLimitsWithUsage: { execute(input: { userId: string }): Promise<SpendingLimitUsage[]> };
  readonly listCategories: { execute(input: { userId: string }): Promise<Category[]> };
  readonly listAccounts: { execute(input: { userId: string }): Promise<Account[]> };
  readonly calculateCreditCardAvailableLimit: { execute(input: { userId: string; accountId: string }): Promise<Money> };
}

/**
 * Busca os dados do widget de limites (spec 023, T005): limites de gasto do mes, categorias e
 * contas, e o limite disponivel SO dos cartoes escolhidos e ativos (o calculo do cartao e o mais
 * caro - nao roda para cartao que o widget nao mostra).
 */
export async function loadLimitsWidgetData(
  sources: LimitsWidgetSources,
  userId: string,
  preferences: LimitsWidgetPreferences,
  month: { readonly year: number; readonly month: number },
): Promise<LimitsWidgetData> {
  const [limits, categories, accounts] = await Promise.all([
    sources.listSpendingLimitsWithUsage.execute({ userId }),
    sources.listCategories.execute({ userId }),
    sources.listAccounts.execute({ userId }),
  ]);
  const chosen = new Set(preferences.visibleCardIds);
  const cardAccounts = accounts.filter((a) => chosen.has(a.id) && a.kind === 'credit-card' && a.creditLimit !== null && !a.archived);
  const cards = await Promise.all(
    cardAccounts.map(async (account) => ({
      account,
      availableCents: (await sources.calculateCreditCardAvailableLimit.execute({ userId, accountId: account.id })).cents,
    })),
  );
  return buildLimitsWidgetData({ month: Month.create(month), limits, categories, cards, preferences });
}
