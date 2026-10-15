import { z } from 'zod';
import { type PreRegistration } from '../../domain/pre-registration/pre.registration.entity.ts';
import { PreRegistrationNotFoundError } from '../../domain/pre-registration/pre.registration.not.found.error.ts';
import { fillMissingFromPreRegistration } from '../../domain/pre-registration/fill.missing.from.pre.registration.ts';
import { type Database } from '../shared/database.port.ts';
import { type Clock } from '../shared/clock.port.ts';
import { InvalidInputError } from '../shared/invalid.input.error.ts';
import { mergePossibleDuplicatesInputSchema } from './merge.possible.duplicates.input.schema.ts';

/**
 * Caso de uso "juntar duplicatas" (spec 028, FR-018): o usuario respondeu "e a mesma compra".
 * Numa transacao, mantem o pre-registro MAIS ANTIGO, completa so os campos vazios dele com os
 * dos outros, repontua os recibos de captura dos outros para ele (reentregas continuam barradas)
 * e descarta os outros. Falta de qualquer id => `PreRegistrationNotFoundError` e nada muda.
 */
export class MergePossibleDuplicatesUseCase {
  private readonly database: Database;
  private readonly clock: Clock;

  public constructor(database: Database, clock: Clock) {
    this.database = database;
    this.clock = clock;
  }

  public async execute(rawInput: unknown): Promise<PreRegistration> {
    const parsed = mergePossibleDuplicatesInputSchema.safeParse(rawInput);
    if (!parsed.success) {
      const flat = z.flattenError(parsed.error);
      throw new InvalidInputError('juntar duplicatas', flat.fieldErrors, flat.formErrors);
    }
    const { userId, ids } = parsed.data;

    return this.database.transaction(async (tx) => {
      const found: PreRegistration[] = [];
      for (const id of ids) {
        const pre = await tx.preRegistrations.findById(userId, id);
        if (pre === null) throw new PreRegistrationNotFoundError();
        found.push(pre);
      }
      found.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id));
      const [survivor, ...others] = found as [PreRegistration, ...PreRegistration[]];
      const removed = new Set(others.map((pre) => pre.id));

      const patch = fillMissingFromPreRegistration(survivor, others);
      const dangling = survivor.possibleDuplicateOf !== null && removed.has(survivor.possibleDuplicateOf);
      const kept = Object.keys(patch).length > 0 || dangling ? survivor.update({ ...patch, ...(dangling ? { possibleDuplicateOf: null } : {}) }) : survivor;
      if (kept !== survivor) await tx.preRegistrations.save(kept);

      for (const other of others) {
        for (const receipt of await tx.captureReceipts.listByPreRegistration(userId, other.id)) {
          await tx.captureReceipts.save(receipt.withPreRegistrationId(survivor.id));
        }
        await tx.captureAttachments.deleteByPreRegistration(userId, other.id);
        await tx.preRegistrations.delete(userId, other.id);
        await tx.preRegistrationOutcomes.record({ userId, preRegistrationId: other.id, outcome: 'discarded', transactionId: null, at: this.clock.now() });
      }

      const stored = (await tx.preRegistrations.findById(userId, survivor.id)) ?? kept;
      // juntar nao e edicao do usuario: a versao "escrita pela captura" acompanha o pre-registro
      const origin = survivor.dedupKey === null ? null : await tx.captureReceipts.findByKey(userId, survivor.dedupKey);
      if (origin !== null && origin.isPending) {
        await tx.captureReceipts.save(origin.withCaptureVersion(stored.updatedAt?.toISOString() ?? null));
      }
      return stored;
    });
  }
}
