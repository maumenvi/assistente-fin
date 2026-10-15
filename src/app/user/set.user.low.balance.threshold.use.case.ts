import { z } from 'zod';
import { type User } from '../../domain/user/user.entity.ts';
import { UserNotFoundError } from '../../domain/user/user.not.found.error.ts';
import { InvalidInputError } from '../shared/invalid.input.error.ts';
import { type UserRepository } from './user.repository.port.ts';
import { setUserLowBalanceThresholdInputSchema } from './set.user.low.balance.threshold.input.schema.ts';

/**
 * Caso de uso "definir limite de saldo baixo do Dashboard" (spec 015, RF-2).
 *
 * `thresholdCents` nulo limpa a preferencia (volta ao padrao do sistema, R$ 400,00, resolvido
 * na borda de leitura do renderer, nao aqui).
 */
export class SetUserLowBalanceThresholdUseCase {
  private readonly users: UserRepository;

  public constructor(users: UserRepository) {
    this.users = users;
  }

  public async execute(rawInput: unknown): Promise<User> {
    const parsed = setUserLowBalanceThresholdInputSchema.safeParse(rawInput);
    if (!parsed.success) {
      const flat = z.flattenError(parsed.error);
      throw new InvalidInputError('definir limite de saldo baixo', flat.fieldErrors, flat.formErrors);
    }

    const input = parsed.data;
    const user = await this.users.findById(input.userId);
    if (!user) {
      throw new UserNotFoundError();
    }

    const updated = user.setLowBalanceThreshold(input.thresholdCents);
    await this.users.save(updated);
    return updated;
  }
}
