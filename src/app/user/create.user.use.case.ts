import { z } from 'zod';
import { User } from '../../domain/user/user.entity.ts';
import { Cpf } from '../../domain/shared/cpf.value.object.ts';
import { Email } from '../../domain/shared/email.value.object.ts';
import { Phone } from '../../domain/shared/phone.value.object.ts';
import { CpfAlreadyRegisteredError } from '../../domain/user/cpf.already.registered.error.ts';
import { EmailAlreadyRegisteredError } from '../../domain/user/email.already.registered.error.ts';
import { PhoneAlreadyRegisteredError } from '../../domain/user/phone.already.registered.error.ts';
import { type Database } from '../shared/database.port.ts';
import { type IdGenerator } from '../shared/id.generator.port.ts';
import { type Clock } from '../shared/clock.port.ts';
import { InvalidInputError } from '../shared/invalid.input.error.ts';
import { ensureDefaultCategory } from '../category/ensure.default.category.ts';
import { createUserInputSchema } from './create.user.input.schema.ts';

/**
 * Caso de uso "criar usuario" (spec 001, RF-15, RF-23, CA-13).
 *
 * Valida a entrada externa com zod na fronteira (`safeParse`, nunca `parse`), normaliza
 * CPF/e-mail/telefone nos respectivos value objects (erro de dominio se malformado - nao
 * zod), checa unicidade dos tres contra o repositorio e so entao persiste. O usuario nasce
 * sem e-mail/telefone verificados (RF-26) - isso e responsabilidade de
 * `RequestVerification`/`ConfirmVerification`.
 *
 * Usuario e categoria padrao nascem na MESMA transacao (spec 003, RF-8, CA-5): um usuario sem
 * "SEM CATEGORIA" nao conseguiria lancar nada sem categoria, entao os dois sao um estado so.
 * Por isso o caso de uso depende do `Database` inteiro, nao so do `UserRepository`.
 */
export class CreateUserUseCase {
  private readonly database: Database;
  private readonly ids: IdGenerator;
  private readonly clock: Clock;

  public constructor(database: Database, ids: IdGenerator, clock: Clock) {
    this.database = database;
    this.ids = ids;
    this.clock = clock;
  }

  public async execute(rawInput: unknown): Promise<User> {
    const parsed = createUserInputSchema.safeParse(rawInput);
    if (!parsed.success) {
      const flat = z.flattenError(parsed.error);
      throw new InvalidInputError('criar usuario', flat.fieldErrors, flat.formErrors);
    }

    const input = parsed.data;
    const cpf = Cpf.create(input.cpf);
    const email = Email.create(input.email);
    const phone = Phone.create(input.phone);

    return this.database.transaction(async (tx) => {
      if (await tx.users.findByCpf(cpf)) {
        throw new CpfAlreadyRegisteredError();
      }
      if (await tx.users.findByEmail(email)) {
        throw new EmailAlreadyRegisteredError();
      }
      if (await tx.users.findByPhone(phone)) {
        throw new PhoneAlreadyRegisteredError();
      }

      const user = User.create({
        id: this.ids.next(),
        cpf,
        email,
        phone,
        name: input.name,
        createdAt: this.clock.now(),
      });

      await tx.users.save(user);
      await ensureDefaultCategory(tx.categories, this.ids, user.id);
      return user;
    });
  }
}
