import { z } from 'zod';
import { type PreRegistration } from '../../domain/pre-registration/pre.registration.entity.ts';
import { PreRegistrationNotFoundError } from '../../domain/pre-registration/pre.registration.not.found.error.ts';
import { type Database } from '../shared/database.port.ts';
import { InvalidInputError } from '../shared/invalid.input.error.ts';
import { dismissPossibleDuplicateInputSchema } from './dismiss.possible.duplicate.input.schema.ts';

/**
 * Caso de uso "sao compras diferentes" (spec 028, FR-018/FR-019): marca cada pre-registro como
 * revisado (`duplicateReviewed`, que tambem zera `possibleDuplicateOf`) e limpa o ponteiro
 * pendurado de quem apontava para um revisado, para que ninguem fique sozinho com a marca de
 * "possivel duplicata". Aprovar depois nao repete o aviso por causa do par ja respondido; o aviso
 * por semelhanca com LANCAMENTOS continua na aprovacao. Id inexistente => `PreRegistrationNotFoundError`.
 */
export class DismissPossibleDuplicateUseCase {
  private readonly database: Database;

  public constructor(database: Database) {
    this.database = database;
  }

  public async execute(rawInput: unknown): Promise<PreRegistration[]> {
    const parsed = dismissPossibleDuplicateInputSchema.safeParse(rawInput);
    if (!parsed.success) {
      const flat = z.flattenError(parsed.error);
      throw new InvalidInputError('marcar compras como diferentes', flat.fieldErrors, flat.formErrors);
    }
    const { userId, ids } = parsed.data;

    return this.database.transaction(async (tx) => {
      const reviewed: PreRegistration[] = [];
      for (const id of ids) {
        const pre = await tx.preRegistrations.findById(userId, id);
        if (pre === null) throw new PreRegistrationNotFoundError();
        const updated = pre.update({ duplicateReviewed: true });
        await tx.preRegistrations.save(updated);
        reviewed.push((await tx.preRegistrations.findById(userId, id)) ?? updated);
      }
      const reviewedIds = new Set(ids);
      for (const pre of await tx.preRegistrations.listByUser(userId)) {
        if (pre.possibleDuplicateOf !== null && reviewedIds.has(pre.possibleDuplicateOf)) {
          await tx.preRegistrations.save(pre.update({ possibleDuplicateOf: null }));
        }
      }
      return reviewed;
    });
  }
}
