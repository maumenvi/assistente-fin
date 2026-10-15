import { z } from 'zod';
import { type User } from '../../domain/user/user.entity.ts';
import { UserNotFoundError } from '../../domain/user/user.not.found.error.ts';
import { type Clock } from '../shared/clock.port.ts';
import { InvalidInputError } from '../shared/invalid.input.error.ts';
import { type UserRepository } from '../user/user.repository.port.ts';
import { linkTelegramInputSchema } from './link.telegram.input.schema.ts';

/**
 * Caso de uso "vincular Telegram" (spec 002, Fase 8.5-T4).
 *
 * O usuario abriu o bot e enviou `/start <token>`; o processo principal ja validou o token e
 * capturou o `chat_id`. Aqui so grava o vinculo - `User.linkTelegram` ja marca o telefone
 * como verificado (abrir o bot prova a posse). Idempotente: revincular so atualiza o
 * `chat_id`, sem mexer na data da 1a verificacao.
 */
export class LinkTelegramUseCase {
  private readonly users: UserRepository;
  private readonly clock: Clock;

  public constructor(users: UserRepository, clock: Clock) {
    this.users = users;
    this.clock = clock;
  }

  public async execute(rawInput: unknown): Promise<User> {
    const parsed = linkTelegramInputSchema.safeParse(rawInput);
    if (!parsed.success) {
      const flat = z.flattenError(parsed.error);
      throw new InvalidInputError('vincular Telegram', flat.fieldErrors, flat.formErrors);
    }

    const { userId, chatId } = parsed.data;
    const user = await this.users.findById(userId);
    if (!user) {
      throw new UserNotFoundError();
    }

    const linked = user.linkTelegram(chatId, this.clock.now());
    await this.users.save(linked);
    return linked;
  }
}
