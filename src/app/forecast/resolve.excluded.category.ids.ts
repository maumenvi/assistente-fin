import { type CategoryRepository } from '../category/category.repository.port.ts';

/**
 * Resolve o `Set` de ids de categoria a excluir do resultado operacional do forecast (spec
 * 016, RF-20): transferencias (`isSystemTransfer`), pagamentos de fatura
 * (`isSystemCardPayment`) e lancamentos sinteticos de saldo/ajuste do usuario.
 * `calculateMonthlyForecast` (dominio, zero-dependencia,
 * rule 10) nao conhece `Category` - este helper mora em `app/` e alimenta o
 * `excludedCategoryIds` que o dominio so consome, mesma filosofia de
 * `resolveCreditCardInvoicesForMonth` (calculado fora, injetado dentro).
 */
export async function resolveExcludedCategoryIds(
  categories: CategoryRepository,
  userId: string,
): Promise<ReadonlySet<string>> {
  const all = await categories.listByUser(userId);
  return new Set(
    all
      .filter(
        (category) =>
          category.isSystemTransfer ||
          category.isSystemCardPayment ||
          category.isSystemOpeningBalance ||
          category.isSystemAdjustment ||
          category.isSystemBalance,
      )
      .map((category) => category.id),
  );
}
