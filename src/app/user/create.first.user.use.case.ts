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
import { type PasswordHasher } from '../shared/password.hasher.port.ts';
import { type RecoveryKeyGenerator } from '../shared/recovery.key.generator.port.ts';
import { InvalidInputError } from '../shared/invalid.input.error.ts';
import { ensureDefaultCategory } from '../category/ensure.default.category.ts';
import { createFirstUserInputSchema } from './create.first.user.input.schema.ts';

/** Resultado de `CreateFirstUserUseCase`: `recoveryKey` so quando uma senha foi definida. */
export interface FirstUserCreated {
  readonly user: User;
  readonly recoveryKey?: string;
}

/**
 * Caso de uso "criar o usuario do primeiro acesso" (spec 002, RF-9, design.md 6.3).
 *
 * Cria o usuario e, quando uma senha e informada, ja grava senha + chave de recuperacao na
 * MESMA transacao (`Database.transaction`). Antes isto eram duas chamadas com compensacao
 * manual: se a segunda falhasse (banco caiu), sobrava um usuario sem senha que o boot
 * seguinte logava sozinho (revisao Fase 3). Agora ou tudo persiste, ou nada.
 *
 * O hash da senha/chave (scrypt, lento) roda ANTES de abrir a transacao - a transacao so
 * envolve as checagens de unicidade e o unico `save`.
 *
 * O 1o usuario nasce com e-mail e telefone JA verificados (decisao do usuario 2026-09-08):
 * quem instala o app e configura o banco e dono da maquina - nao faz sentido barra-lo por
 * verificacao antes mesmo de haver um canal de envio configurado. Do 2o usuario em diante
 * (`CreateUserUseCase`) a verificacao volta a valer, e um canal ja basta.
 */
export class CreateFirstUserUseCase {
  private readonly database: Database;
  private readonly ids: IdGenerator;
  private readonly clock: Clock;
  private readonly hasher: PasswordHasher;
  private readonly recoveryKeys: RecoveryKeyGenerator;

  public constructor(
    database: Database,
    ids: IdGenerator,
    clock: Clock,
    hasher: PasswordHasher,
    recoveryKeys: RecoveryKeyGenerator,
  ) {
    this.database = database;
    this.ids = ids;
    this.clock = clock;
    this.hasher = hasher;
    this.recoveryKeys = recoveryKeys;
  }

  public async execute(rawInput: unknown): Promise<FirstUserCreated> {
    const parsed = createFirstUserInputSchema.safeParse(rawInput);
    if (!parsed.success) {
      const flat = z.flattenError(parsed.error);
      throw new InvalidInputError('primeiro acesso', flat.fieldErrors, flat.formErrors);
    }

    const { password, ...input } = parsed.data;
    const cpf = Cpf.create(input.cpf);
    const email = Email.create(input.email);
    const phone = Phone.create(input.phone);

    let recoveryKey: string | undefined;
    let passwordHash: string | undefined;
    let recoveryKeyHash: string | undefined;
    if (password !== undefined) {
      recoveryKey = this.recoveryKeys.next();
      [passwordHash, recoveryKeyHash] = await Promise.all([
        this.hasher.hash(password),
        this.hasher.hash(recoveryKey),
      ]);
    }

    const user = await this.database.transaction(async (tx) => {
      if (await tx.users.findByCpf(cpf)) {
        throw new CpfAlreadyRegisteredError();
      }
      if (await tx.users.findByEmail(email)) {
        throw new EmailAlreadyRegisteredError();
      }
      if (await tx.users.findByPhone(phone)) {
        throw new PhoneAlreadyRegisteredError();
      }

      const now = this.clock.now();
      let created = User.create({
        id: this.ids.next(),
        cpf,
        email,
        phone,
        name: input.name,
        createdAt: now,
      })
        .verifyEmail(now)
        .verifyPhone(now);
      if (passwordHash !== undefined && recoveryKeyHash !== undefined) {
        created = created.setPassword(passwordHash).setRecoveryKey(recoveryKeyHash);
      }
      await tx.users.save(created);
      // usuario e categoria padrao sao um estado so (spec 003, RF-8, CA-5)
      await ensureDefaultCategory(tx.categories, this.ids, created.id);
      return created;
    });

    return recoveryKey === undefined ? { user } : { user, recoveryKey };
  }
}
