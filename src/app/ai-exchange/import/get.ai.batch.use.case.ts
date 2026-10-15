import { z } from 'zod';
import { InvalidInputError } from '../../shared/invalid.input.error.ts';
import { type AiBatch } from '../ai.batch.ts';
import { type AiBatchOp } from '../ai.batch.op.ts';
import { type AiBatchStore } from '../ai.batch.store.port.ts';
import { AiBatchNotFoundError } from '../errors/ai.batch.not.found.error.ts';

const inputSchema = z.object({
  userId: z.string().trim().min(1, 'userId obrigatorio'),
  batchId: z.string().trim().min(1, 'batchId obrigatorio'),
});

/** Um lote do diario com todas as operacoes (spec 029, FR-007): base das telas de resultado e de apagar. */
export class GetAiBatchUseCase {
  private readonly store: AiBatchStore;

  public constructor(store: AiBatchStore) {
    this.store = store;
  }

  public async execute(rawInput: unknown): Promise<{ batch: AiBatch; ops: AiBatchOp[] }> {
    const parsed = inputSchema.safeParse(rawInput);
    if (!parsed.success) {
      const flat = z.flattenError(parsed.error);
      throw new InvalidInputError('ler importacao da IA', flat.fieldErrors, flat.formErrors);
    }
    const batch = await this.store.findBatch(parsed.data.userId, parsed.data.batchId);
    if (batch === null) throw new AiBatchNotFoundError();
    return { batch, ops: await this.store.listOps(parsed.data.batchId) };
  }
}
