import { Category } from '../../domain/category/category.entity.ts';
import { CategoryName } from '../../domain/category/category.name.value.object.ts';
import { CARD_PAYMENT_CATEGORY_NAME } from '../../domain/category/card.payment.category.name.ts';
import { type IdGenerator } from '../shared/id.generator.port.ts';
import { type CategoryRepository } from './category.repository.port.ts';

/**
 * Devolve a categoria de sistema de pagamento de fatura de cartao do usuario, criando-a se
 * ainda nao existir (spec 016, RF-2).
 *
 * Idempotente: chamada duas vezes devolve a mesma categoria, sem criar uma segunda. Quem
 * procura e `findSystemCardPayment` (flag `isSystemCardPayment`), nao o nome - mesmo padrao
 * de `ensureAdjustmentCategory`.
 */
export async function ensureCardPaymentCategory(
  categories: CategoryRepository,
  ids: IdGenerator,
  userId: string,
): Promise<Category> {
  const existing = await categories.findSystemCardPayment(userId);
  if (existing) {
    return existing;
  }

  const created = Category.create({
    id: ids.next(),
    userId,
    name: CategoryName.create(CARD_PAYMENT_CATEGORY_NAME),
    isSystemCardPayment: true,
  });
  await categories.save(created);
  return created;
}
