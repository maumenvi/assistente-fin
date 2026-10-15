import { z } from 'zod';
import { type PreRegistration } from '../../domain/pre-registration/pre.registration.entity.ts';
import { type PreRegistrationRepository } from './pre.registration.repository.port.ts';
import { InvalidInputError } from '../shared/invalid.input.error.ts';
import { listPreRegistrationsInputSchema } from './list.pre.registrations.input.schema.ts';

/** Caso de uso "listar pre-registros pendentes" (spec 022), mais recentes primeiro. */
export class ListPreRegistrationsUseCase {
  private readonly preRegistrations: PreRegistrationRepository;

  public constructor(preRegistrations: PreRegistrationRepository) {
    this.preRegistrations = preRegistrations;
  }

  public async execute(rawInput: unknown): Promise<PreRegistration[]> {
    const parsed = listPreRegistrationsInputSchema.safeParse(rawInput);
    if (!parsed.success) {
      const flat = z.flattenError(parsed.error);
      throw new InvalidInputError('listar pre-registros', flat.fieldErrors, flat.formErrors);
    }
    return this.preRegistrations.listByUser(parsed.data.userId);
  }
}
