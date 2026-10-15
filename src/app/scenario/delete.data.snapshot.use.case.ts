import { z } from 'zod';
import { type DataSnapshot } from '../../domain/scenario/data.snapshot.entity.ts';
import { DataSnapshotNotFoundError } from '../../domain/scenario/data.snapshot.not.found.error.ts';
import { InvalidInputError } from '../shared/invalid.input.error.ts';
import { type DataSnapshotRepository } from './data.snapshot.repository.port.ts';
import { snapshotIdInputSchema } from './snapshot.id.input.schema.ts';

/**
 * Caso de uso "excluir um ponto de restauracao" (spec 002, RF-40a). Retencao manual: so o
 * usuario apaga. Nao altera os dados atuais. `DataSnapshotNotFoundError` fora do escopo do
 * usuario. Devolve o snapshot removido.
 */
export class DeleteDataSnapshotUseCase {
  private readonly snapshots: DataSnapshotRepository;

  public constructor(snapshots: DataSnapshotRepository) {
    this.snapshots = snapshots;
  }

  public async execute(rawInput: unknown): Promise<DataSnapshot> {
    const parsed = snapshotIdInputSchema.safeParse(rawInput);
    if (!parsed.success) {
      const flat = z.flattenError(parsed.error);
      throw new InvalidInputError('excluir snapshot', flat.fieldErrors, flat.formErrors);
    }

    const existing = await this.snapshots.findById(parsed.data.userId, parsed.data.snapshotId);
    if (!existing) {
      throw new DataSnapshotNotFoundError();
    }

    await this.snapshots.delete(parsed.data.userId, parsed.data.snapshotId);
    return existing;
  }
}
