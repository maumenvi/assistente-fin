import { z } from 'zod';
import { InvalidInputError } from '../../shared/invalid.input.error.ts';
import { type AiBatch } from '../ai.batch.ts';
import { type AiBatchStore } from '../ai.batch.store.port.ts';

const inputSchema = z.object({
  userId: z.string().trim().min(1, 'userId obrigatorio'),
  limit: z.int().min(1).max(200).default(50),
});

/** Historico de importacoes da IA, mais recentes primeiro (spec 029, FR-007, tela de historico). */
export class ListAiBatchesUseCase {
  private readonly store: AiBatchStore;

  public constructor(store: AiBatchStore) {
    this.store = store;
  }

  public async execute(rawInput: unknown): Promise<AiBatch[]> {
    const parsed = inputSchema.safeParse(rawInput);
    if (!parsed.success) {
      const flat = z.flattenError(parsed.error);
      throw new InvalidInputError('listar importacoes da IA', flat.fieldErrors, flat.formErrors);
    }
    return this.store.listBatches(parsed.data.userId, parsed.data.limit);
  }
}
