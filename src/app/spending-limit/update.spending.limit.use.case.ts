import { z } from 'zod';
import { SpendingLimit } from '../../domain/spending-limit/spending.limit.entity.ts';
import { Money } from '../../domain/shared/money.value.object.ts';
import { Month } from '../../domain/shared/month.value.object.ts';
import { SpendingLimitNotFoundError } from '../../domain/spending-limit/spending.limit.not.found.error.ts';
import { InvalidInputError } from '../shared/invalid.input.error.ts';
import { type IdGenerator } from '../shared/id.generator.port.ts';
import { type CategoryRepository } from '../category/category.repository.port.ts';
import { resolveCategoryIdOrKeep } from '../category/resolve.category.id.or.keep.ts';
import { type SpendingLimitRepository } from './spending.limit.repository.port.ts';
import { updateSpendingLimitInputSchema } from './update.spending.limit.input.schema.ts';

/**
 * Caso de uso "atualizar limite de gasto" (spec 002, RF-19, RF-31).
 *
 * `SpendingLimitNotFoundError` fora do escopo do usuario (CA-14). `SpendingLimit` nao tem
 * transicoes: reconstroi via `SpendingLimit.create` com o mesmo id, mesclando os campos
 * enviados, e `withUpdatedAt(expectedUpdatedAt ?? existing.updatedAt)` - trava otimista no
 * save. Nao exige verificacao (editar != criar).
 */
export class UpdateSpendingLimitUseCase {
  private readonly spendingLimits: SpendingLimitRepository;
  private readonly categories: CategoryRepository;
  private readonly ids: IdGenerator;

  public constructor(
    spendingLimits: SpendingLimitRepository,
    categories: CategoryRepository,
    ids: IdGenerator,
  ) {
    this.spendingLimits = spendingLimits;
    this.categories = categories;
    this.ids = ids;
  }

  public async execute(rawInput: unknown): Promise<SpendingLimit> {
    const parsed = updateSpendingLimitInputSchema.safeParse(rawInput);
    if (!parsed.success) {
      const flat = z.flattenError(parsed.error);
      throw new InvalidInputError('atualizar limite de gasto', flat.fieldErrors, flat.formErrors);
    }

    const input = parsed.data;
    const existing = await this.spendingLimits.findById(input.userId, input.id);
    if (!existing) {
      throw new SpendingLimitNotFoundError();
    }

    const categoryId = await resolveCategoryIdOrKeep(
      this.categories,
      this.ids,
      input,
      existing.categoryId,
    );

    const updated = SpendingLimit.create({
      id: existing.id,
      userId: existing.userId,
      categoryId,
      period: input.period !== undefined ? Month.create(input.period) : existing.period,
      maxAmount:
        input.maxAmountCents !== undefined
          ? Money.fromCents(input.maxAmountCents)
          : existing.maxAmount,
    }).withUpdatedAt(
      input.expectedUpdatedAt !== undefined
        ? new Date(input.expectedUpdatedAt)
        : existing.updatedAt,
    );

    await this.spendingLimits.save(updated);
    return updated;
  }
}
