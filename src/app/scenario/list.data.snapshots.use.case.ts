import { z } from 'zod';
import { type DataSnapshot } from '../../domain/scenario/data.snapshot.entity.ts';
import { InvalidInputError } from '../shared/invalid.input.error.ts';
import { type DataSnapshotRepository } from './data.snapshot.repository.port.ts';

const inputSchema = z.object({
  userId: z.string().trim().min(1, 'userId obrigatorio'),
});

/**
 * Caso de uso "listar pontos de restauracao do usuario" (spec 002, RF-40a). So leitura,
 * do mais recente para o mais antigo. Devolve as entidades completas (o `payload` inclusive);
 * a borda decide o que exibir.
 */
export class ListDataSnapshotsUseCase {
  private readonly snapshots: DataSnapshotRepository;

  public constructor(snapshots: DataSnapshotRepository) {
    this.snapshots = snapshots;
  }

  public async execute(rawInput: unknown): Promise<DataSnapshot[]> {
    const parsed = inputSchema.safeParse(rawInput);
    if (!parsed.success) {
      const flat = z.flattenError(parsed.error);
      throw new InvalidInputError('listar snapshots', flat.fieldErrors, flat.formErrors);
    }

    return this.snapshots.listByUser(parsed.data.userId);
  }
}
