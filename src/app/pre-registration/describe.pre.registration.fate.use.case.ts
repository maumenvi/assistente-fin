import { z } from 'zod';
import { type Database } from '../shared/database.port.ts';
import { InvalidInputError } from '../shared/invalid.input.error.ts';
import { describePreRegistrationFateInputSchema } from './describe.pre.registration.fate.input.schema.ts';
import { type PreRegistrationFate } from './pre.registration.fate.ts';

/**
 * Caso de uso "o que aconteceu com este pre-registro?" (spec 027, FR-006/FR-007, R6). A tela
 * chama quando aprovar/editar/abrir recebe "nao encontrado", para mostrar a mensagem certa em vez
 * de um generico "talvez ja aprovado ou descartado".
 */
export class DescribePreRegistrationFateUseCase {
  private readonly database: Database;

  public constructor(database: Database) {
    this.database = database;
  }

  public async execute(rawInput: unknown): Promise<PreRegistrationFate> {
    const parsed = describePreRegistrationFateInputSchema.safeParse(rawInput);
    if (!parsed.success) {
      const flat = z.flattenError(parsed.error);
      throw new InvalidInputError('consultar pre-registro', flat.fieldErrors, flat.formErrors);
    }
    const { userId, id } = parsed.data;
    if (await this.database.preRegistrations.findById(userId, id)) return { outcome: 'pending' };
    const recorded = await this.database.preRegistrationOutcomes.find(userId, id);
    if (recorded === null) return { outcome: 'unknown' };
    return recorded.outcome === 'approved' ? { outcome: 'approved', transactionId: recorded.transactionId } : { outcome: 'discarded' };
  }
}
