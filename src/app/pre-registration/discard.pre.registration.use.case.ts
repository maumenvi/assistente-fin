import { z } from 'zod';
import { PreRegistrationNotFoundError } from '../../domain/pre-registration/pre.registration.not.found.error.ts';
import { type Database } from '../shared/database.port.ts';
import { type Clock } from '../shared/clock.port.ts';
import { InvalidInputError } from '../shared/invalid.input.error.ts';
import { preRegistrationIdInputSchema } from './pre.registration.id.input.schema.ts';

/** Caso de uso "descartar pre-registro" (spec 022, FR-026): some com os anexos, sem lancamento. */
export class DiscardPreRegistrationUseCase {
  private readonly database: Database;
  private readonly clock: Clock;

  public constructor(database: Database, clock: Clock) {
    this.database = database;
    this.clock = clock;
  }

  public async execute(rawInput: unknown): Promise<void> {
    const parsed = preRegistrationIdInputSchema.safeParse(rawInput);
    if (!parsed.success) {
      const flat = z.flattenError(parsed.error);
      throw new InvalidInputError('descartar pre-registro', flat.fieldErrors, flat.formErrors);
    }
    const { userId, id } = parsed.data;
    await this.database.transaction(async (tx) => {
      if (!(await tx.preRegistrations.findById(userId, id))) throw new PreRegistrationNotFoundError();
      await tx.captureAttachments.deleteByPreRegistration(userId, id);
      await tx.preRegistrations.delete(userId, id);
      // spec 027 (FR-004): a compra fica marcada como descartada - uma reentrega nao a recria
      // spec 028: varias chaves de notificacao podem apontar para o mesmo pre-registro - todas resolvem
      for (const receipt of await tx.captureReceipts.listByPreRegistration(userId, id)) {
        await tx.captureReceipts.save(receipt.resolve('discarded', this.clock.now()));
      }
      // spec 027 (R6): destino gravado para explicar um "nao encontrado" posterior
      await tx.preRegistrationOutcomes.record({ userId, preRegistrationId: id, outcome: 'discarded', transactionId: null, at: this.clock.now() });
    });
  }
}
