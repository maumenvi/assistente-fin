import { InvalidDataSnapshotError } from './invalid.data.snapshot.error.ts';

/** Contagem de registros por tipo dentro do snapshot (ex.: `{ account: 2, income: 5 }`). */
export type SnapshotRecordCounts = Readonly<Record<string, number>>;

/** Dados necessarios para criar um snapshot. */
export interface CreateDataSnapshotProps {
  readonly id: string;
  readonly userId: string;
  /** Cenario que originou o snapshot, ou `null` se foi criado avulso. */
  readonly originScenarioId: string | null;
  readonly takenAt: Date;
  readonly recordCounts: SnapshotRecordCounts;
  /** Conteudo NDJSON de `BackupRecord` (mesmo formato da Fase 8). */
  readonly payload: string;
}

/** Dados de um snapshot ja persistido (iguais aos de criacao - nao ha mutacao). */
export type DataSnapshotPersistenceProps = CreateDataSnapshotProps;

/**
 * Snapshot / ponto de restauracao dos dados do usuario (spec 002, RF-37, RF-40a, RF-40b).
 *
 * Imutavel e sem transicoes. Criado automaticamente antes de aplicar um cenario; o usuario
 * gerencia a lista manualmente (exportar JSON / restaurar / excluir). `payload` e o NDJSON
 * que `ExportBackupUseCase` produziria naquele instante; `RestoreDataSnapshot` o reimporta.
 */
export class DataSnapshot {
  public readonly id: string;
  public readonly userId: string;
  public readonly originScenarioId: string | null;
  public readonly takenAt: Date;
  public readonly recordCounts: SnapshotRecordCounts;
  public readonly payload: string;

  private constructor(props: CreateDataSnapshotProps) {
    this.id = props.id;
    this.userId = props.userId;
    this.originScenarioId = props.originScenarioId;
    this.takenAt = props.takenAt;
    this.recordCounts = props.recordCounts;
    this.payload = props.payload;
  }

  public static create(props: CreateDataSnapshotProps): DataSnapshot {
    return DataSnapshot.build(props);
  }

  /** Reconstroi um snapshot ja persistido, reaplicando as mesmas invariantes. */
  public static fromPersistence(props: DataSnapshotPersistenceProps): DataSnapshot {
    return DataSnapshot.build(props);
  }

  private static build(props: CreateDataSnapshotProps): DataSnapshot {
    const id = props.id.trim();
    const userId = props.userId.trim();
    const originScenarioId =
      props.originScenarioId === null ? null : props.originScenarioId.trim();

    if (id === '') throw new InvalidDataSnapshotError('id obrigatorio');
    if (userId === '') throw new InvalidDataSnapshotError('userId obrigatorio');
    if (originScenarioId === '') {
      throw new InvalidDataSnapshotError('originScenarioId deve ser null ou um id nao vazio');
    }
    if (!(props.takenAt instanceof Date) || Number.isNaN(props.takenAt.getTime())) {
      throw new InvalidDataSnapshotError('takenAt deve ser uma data valida');
    }
    if (!isRecordCounts(props.recordCounts)) {
      throw new InvalidDataSnapshotError('recordCounts deve mapear tipo -> inteiro >= 0');
    }
    if (typeof props.payload !== 'string' || props.payload.trim() === '') {
      throw new InvalidDataSnapshotError('payload obrigatorio');
    }

    return new DataSnapshot({
      id,
      userId,
      originScenarioId,
      takenAt: props.takenAt,
      recordCounts: { ...props.recordCounts },
      payload: props.payload,
    });
  }
}

function isRecordCounts(value: unknown): value is SnapshotRecordCounts {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.values(value).every((count) => Number.isInteger(count) && (count as number) >= 0)
  );
}
