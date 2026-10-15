import { z } from 'zod';
import { type Database } from '../shared/database.port.ts';
import { type Clock } from '../shared/clock.port.ts';
import { InvalidInputError } from '../shared/invalid.input.error.ts';
import { CAPTURE_MEMORY_DAYS } from './capture.memory.days.ts';
import { purgeCaptureMemoryInputSchema } from './purge.capture.memory.input.schema.ts';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Caso de uso "limpar a memoria de capturas" (spec 027, R4): apaga recibos de compras resolvidas
 * e destinos de pre-registro com mais de `CAPTURE_MEMORY_DAYS` dias. Recibos pendentes nunca saem.
 * O celular chama uma vez ao abrir.
 */
export class PurgeCaptureMemoryUseCase {
  private readonly database: Database;
  private readonly clock: Clock;

  public constructor(database: Database, clock: Clock) {
    this.database = database;
    this.clock = clock;
  }

  public async execute(rawInput: unknown): Promise<{ receipts: number; outcomes: number }> {
    const parsed = purgeCaptureMemoryInputSchema.safeParse(rawInput);
    if (!parsed.success) {
      const flat = z.flattenError(parsed.error);
      throw new InvalidInputError('limpar memoria de capturas', flat.fieldErrors, flat.formErrors);
    }
    const before = new Date(this.clock.now().getTime() - CAPTURE_MEMORY_DAYS * DAY_MS);
    const { userId } = parsed.data;
    return {
      receipts: await this.database.captureReceipts.purgeResolvedBefore(userId, before),
      outcomes: await this.database.preRegistrationOutcomes.purgeBefore(userId, before),
    };
  }
}
