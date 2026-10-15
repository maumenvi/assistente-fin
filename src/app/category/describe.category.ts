import { type Category } from '../../domain/category/category.entity.ts';
import { type DescribedCategory } from './described.category.ts';

/**
 * Descreve a categoria de um lancamento para as telas (spec 022: extraido do `main` do desktop
 * para o celular usar a mesma regra). Categoria nao encontrada = nome vazio, sem marcas.
 */
export function describeCategory(found: Category | undefined): DescribedCategory {
  return {
    categoryName: found?.name.value ?? '',
    pendingClassification: found?.isDefault ?? false,
    isSystemCategory:
      (found?.isSystemOpeningBalance ?? false) ||
      (found?.isSystemAdjustment ?? false) ||
      (found?.isSystemBalance ?? false),
    isSystemTransfer: found?.isSystemTransfer ?? false,
    isSystemCardPayment: found?.isSystemCardPayment ?? false,
  };
}
