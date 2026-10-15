import { type PendingConflictSource, type PendingConflictSummary } from '../pre-registration/pending.conflict.source.ts';
import { type BackupRecord } from '../shared/backup.record.schema.ts';
import { type SyncEntity } from './sync.entity.ts';
import { type SyncOutbox } from './sync.outbox.port.ts';

const ENTITY_LABEL: Readonly<Record<SyncEntity, string>> = {
  category: 'categoria',
  account: 'conta',
  income: 'ganho',
  fixedExpense: 'gasto fixo',
  spendingLimitPlan: 'plano de limites',
  spendingLimit: 'limite de gasto',
  transactionSeries: 'recorrência',
  transaction: 'lançamento',
  purchaseSimulation: 'simulação',
  preRegistration: 'pré-registro',
  captureAttachment: 'anexo',
};

/** Nome curto do registro para o sino ("conta Itau", "lançamento Mercado"). */
export function describeConflictRecord(entity: SyncEntity, record: BackupRecord | null): string {
  const fields = (record ?? {}) as Record<string, unknown>;
  const name = [fields['name'], fields['description'], fields['source'], fields['notes']].find(
    (value): value is string => typeof value === 'string' && value.trim() !== '',
  );
  return name === undefined ? ENTITY_LABEL[entity] : `${ENTITY_LABEL[entity]} ${name.slice(0, 40)}`;
}

/** Conflitos do outbox como pendencias do sino (spec 022, T121; FR-029). */
export class OutboxConflictSource implements PendingConflictSource {
  private readonly outbox: SyncOutbox;

  public constructor(outbox: SyncOutbox) {
    this.outbox = outbox;
  }

  public async listByUser(): Promise<PendingConflictSummary[]> {
    return (await this.outbox.listConflicts()).map((conflict) => ({
      id: conflict.id,
      entityLabel: describeConflictRecord(conflict.entity, conflict.localRecord ?? conflict.remoteRecord),
      detectedAt: conflict.detectedAt,
    }));
  }
}
