import { z } from 'zod';
import { PreRegistration } from '../../domain/pre-registration/pre.registration.entity.ts';
import { findPossibleDuplicate } from '../../domain/pre-registration/find.possible.duplicate.ts';
import { type Database } from '../shared/database.port.ts';
import { type IdGenerator } from '../shared/id.generator.port.ts';
import { type Clock } from '../shared/clock.port.ts';
import { InvalidInputError } from '../shared/invalid.input.error.ts';
import { createPreRegistrationInputSchema } from './create.pre.registration.input.schema.ts';
import { toPreRegistrationPatch } from './to.pre.registration.patch.ts';

/**
 * Caso de uso "criar pre-registro" (spec 022, FR-021/FR-022/FR-027). SEMPRE grava - mesmo
 * incompleto, mesmo parecido com algo existente (melhor recusar depois do que perder a
 * anotacao). Se achar pre-registro ou lancamento parecido, marca `possibleDuplicateOf`.
 */
export class CreatePreRegistrationUseCase {
  private readonly database: Database;
  private readonly ids: IdGenerator;
  private readonly clock: Clock;

  public constructor(database: Database, ids: IdGenerator, clock: Clock) {
    this.database = database;
    this.ids = ids;
    this.clock = clock;
  }

  public async execute(rawInput: unknown): Promise<PreRegistration> {
    const parsed = createPreRegistrationInputSchema.safeParse(rawInput);
    if (!parsed.success) {
      const flat = z.flattenError(parsed.error);
      throw new InvalidInputError('criar pre-registro', flat.fieldErrors, flat.formErrors);
    }
    const input = parsed.data;
    const draft = PreRegistration.create({
      id: this.ids.next(),
      userId: input.userId,
      origin: input.origin,
      createdAt: this.clock.now(),
      dedupKey: input.dedupKey ?? null,
      sourceDevice: input.sourceDevice ?? null,
      manualOnly: input.manualOnly ?? false,
      ...toPreRegistrationPatch(input),
    });

    const [pending, transactions] = await Promise.all([
      this.database.preRegistrations.listByUser(input.userId),
      this.database.transactions.listByUser(input.userId),
    ]);
    const duplicateOf = findPossibleDuplicate(
      {
        dedupKey: draft.dedupKey,
        link: input.link ?? null,
        amountCents: draft.amount?.cents ?? null,
        date: draft.date,
        description: draft.description,
      },
      pending.map((pre) => ({
        id: pre.id,
        dedupKey: pre.dedupKey,
        amountCents: pre.amount?.cents ?? null,
        date: pre.date,
        description: pre.description,
        notes: pre.notes,
      })),
      transactions.map((tx) => ({ id: tx.id, amountCents: tx.amount.cents, date: tx.date, notes: tx.notes })),
    );

    const pre = duplicateOf === null ? draft : draft.update({ possibleDuplicateOf: duplicateOf });
    await this.database.preRegistrations.save(pre);
    return pre;
  }
}
