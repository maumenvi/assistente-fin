import { z } from 'zod';
import { type Income } from '../../domain/income/income.entity.ts';
import { IncomeNotFoundError } from '../../domain/income/income.not.found.error.ts';
import { InvalidInputError } from '../shared/invalid.input.error.ts';
import { type IncomeRepository } from './income.repository.port.ts';
import { deleteIncomeInputSchema } from './delete.income.input.schema.ts';

/**
 * Caso de uso "excluir ganho" (spec 002, RF-17).
 *
 * Busca no escopo do usuario antes de remover pra devolver `IncomeNotFoundError` quando nao
 * existir ou for de outro (CA-14) - o `delete` do repositorio, sozinho, e silencioso.
 * Devolve o ganho removido.
 */
export class DeleteIncomeUseCase {
  private readonly incomes: IncomeRepository;

  public constructor(incomes: IncomeRepository) {
    this.incomes = incomes;
  }

  public async execute(rawInput: unknown): Promise<Income> {
    const parsed = deleteIncomeInputSchema.safeParse(rawInput);
    if (!parsed.success) {
      const flat = z.flattenError(parsed.error);
      throw new InvalidInputError('excluir ganho', flat.fieldErrors, flat.formErrors);
    }

    const input = parsed.data;
    const existing = await this.incomes.findById(input.userId, input.id);
    if (!existing) {
      throw new IncomeNotFoundError();
    }

    await this.incomes.delete(input.userId, input.id);
    return existing;
  }
}
