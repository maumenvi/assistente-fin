import { z } from 'zod';
import { Income } from '../../domain/income/income.entity.ts';
import { Money } from '../../domain/shared/money.value.object.ts';
import { toRecurrence } from '../shared/to.recurrence.ts';
import { IncomeNotFoundError } from '../../domain/income/income.not.found.error.ts';
import { InvalidInputError } from '../shared/invalid.input.error.ts';
import { type IdGenerator } from '../shared/id.generator.port.ts';
import { type CategoryRepository } from '../category/category.repository.port.ts';
import { resolveCategoryIdOrKeep } from '../category/resolve.category.id.or.keep.ts';
import { type IncomeRepository } from './income.repository.port.ts';
import { updateIncomeInputSchema } from './update.income.input.schema.ts';

/**
 * Caso de uso "atualizar ganho" (spec 002, RF-17, RF-31).
 *
 * `IncomeNotFoundError` se nao existir no escopo do usuario (CA-14). `Income` nao tem
 * transicoes, entao reconstroi via `Income.create` com o mesmo id, mesclando so os campos
 * enviados. Carrega `expectedUpdatedAt` (a versao que a borda leu) no entidade via
 * `withUpdatedAt` - o `save` compara com o banco e lanca `StaleDataError` se mudou; sem
 * `expectedUpdatedAt`, usa a versao lida agora (janela estreita).
 */
export class UpdateIncomeUseCase {
  private readonly incomes: IncomeRepository;
  private readonly categories: CategoryRepository;
  private readonly ids: IdGenerator;

  public constructor(incomes: IncomeRepository, categories: CategoryRepository, ids: IdGenerator) {
    this.incomes = incomes;
    this.categories = categories;
    this.ids = ids;
  }

  public async execute(rawInput: unknown): Promise<Income> {
    const parsed = updateIncomeInputSchema.safeParse(rawInput);
    if (!parsed.success) {
      const flat = z.flattenError(parsed.error);
      throw new InvalidInputError('atualizar ganho', flat.fieldErrors, flat.formErrors);
    }

    const input = parsed.data;
    const existing = await this.incomes.findById(input.userId, input.id);
    if (!existing) {
      throw new IncomeNotFoundError();
    }

    const expected =
      input.expectedUpdatedAt !== undefined ? new Date(input.expectedUpdatedAt) : existing.updatedAt;

    const categoryId = await resolveCategoryIdOrKeep(
      this.categories,
      this.ids,
      input,
      existing.categoryId,
    );

    const updated = Income.create({
      id: existing.id,
      userId: existing.userId,
      date: input.date !== undefined ? new Date(input.date) : existing.date,
      amount: input.amountCents !== undefined ? Money.fromCents(input.amountCents) : existing.amount,
      source: input.source ?? existing.source,
      recurrence: input.recurrence !== undefined ? toRecurrence(input.recurrence) : existing.recurrence,
      categoryId,
      notes: input.notes !== undefined ? input.notes : existing.notes,
      // accountId (spec 012, RF-14): `undefined` = campo nao enviado, mantem o vinculo atual;
      // `null` explicito desvincula a conta. So `undefined` distingue "nao mandou" de "manda
      // null" - `input.accountId` ja e `string | null | undefined` pelo schema.
      accountId: input.accountId !== undefined ? input.accountId : existing.accountId,
    }).withUpdatedAt(expected);

    await this.incomes.save(updated);
    // rele a versao persistida: `save` recarimba o `updatedAt` (RF-31).
    return (await this.incomes.findById(input.userId, input.id)) ?? updated;
  }
}
