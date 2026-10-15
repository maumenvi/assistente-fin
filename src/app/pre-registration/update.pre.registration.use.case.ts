import { z } from 'zod';
import { type PreRegistration } from '../../domain/pre-registration/pre.registration.entity.ts';
import { PreRegistrationNotFoundError } from '../../domain/pre-registration/pre.registration.not.found.error.ts';
import { type Database } from '../shared/database.port.ts';
import { InvalidInputError } from '../shared/invalid.input.error.ts';
import { StaleDataError } from '../shared/stale.data.error.ts';
import { updatePreRegistrationInputSchema } from './update.pre.registration.input.schema.ts';
import { toPreRegistrationPatch } from './to.pre.registration.patch.ts';

/** Caso de uso "editar pre-registro" (spec 022, FR-023): qualquer campo, continua pendente. */
export class UpdatePreRegistrationUseCase {
  private readonly database: Database;

  public constructor(database: Database) {
    this.database = database;
  }

  public async execute(rawInput: unknown): Promise<PreRegistration> {
    const parsed = updatePreRegistrationInputSchema.safeParse(rawInput);
    if (!parsed.success) {
      const flat = z.flattenError(parsed.error);
      throw new InvalidInputError('editar pre-registro', flat.fieldErrors, flat.formErrors);
    }
    const input = parsed.data;
    const current = await this.database.preRegistrations.findById(input.userId, input.id);
    if (!current) throw new PreRegistrationNotFoundError();
    if (input.expectedUpdatedAt !== undefined && current.updatedAt?.toISOString() !== new Date(input.expectedUpdatedAt).toISOString()) {
      throw new StaleDataError('pre-registro');
    }
    const updated = current.update(toPreRegistrationPatch(input));
    await this.database.preRegistrations.save(updated);
    return (await this.database.preRegistrations.findById(input.userId, input.id)) ?? updated;
  }
}
