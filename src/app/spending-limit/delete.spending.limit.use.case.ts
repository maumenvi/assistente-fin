import { z } from 'zod';
import { type SpendingLimit } from '../../domain/spending-limit/spending.limit.entity.ts';
import { SpendingLimitNotFoundError } from '../../domain/spending-limit/spending.limit.not.found.error.ts';
import { InvalidInputError } from '../shared/invalid.input.error.ts';
import { type SpendingLimitRepository } from './spending.limit.repository.port.ts';
import { deleteSpendingLimitInputSchema } from './delete.spending.limit.input.schema.ts';

/**
 * Caso de uso "excluir limite de gasto" (spec 002, RF-19). Busca no escopo do usuario antes
 * de remover pra devolver `SpendingLimitNotFoundError` (CA-14). Devolve o limite removido.
 */
export class DeleteSpendingLimitUseCase {
  private readonly spendingLimits: SpendingLimitRepository;

  public constructor(spendingLimits: SpendingLimitRepository) {
    this.spendingLimits = spendingLimits;
  }

  public async execute(rawInput: unknown): Promise<SpendingLimit> {
    const parsed = deleteSpendingLimitInputSchema.safeParse(rawInput);
    if (!parsed.success) {
      const flat = z.flattenError(parsed.error);
      throw new InvalidInputError('excluir limite de gasto', flat.fieldErrors, flat.formErrors);
    }

    const input = parsed.data;
    const existing = await this.spendingLimits.findById(input.userId, input.id);
    if (!existing) {
      throw new SpendingLimitNotFoundError();
    }

    await this.spendingLimits.delete(input.userId, input.id);
    return existing;
  }
}
