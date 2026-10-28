import { type Database } from '../shared/database.port.ts';
import { type BackupRecord } from '../shared/backup.record.schema.ts';
import * as mapper from '../backup/backup.record.mapper.ts';
import { type SyncEntity } from './sync.entity.ts';

/**
 * Como a sincronizacao le, grava e versiona cada entidade (spec 022, T110): pelos mappers do
 * backup (o record e o payload) e pelos MESMOS repositorios do app. A versao e o `updatedAt` do
 * banco que responde; anexo nao muda, entao a versao e o proprio sha256.
 */
export interface SyncEntityCodec {
  toRecord(entity: object): BackupRecord;
  fromRecord(record: BackupRecord): object;
  version(entity: object): string | null;
  find(db: Database, userId: string, id: string): Promise<object | null>;
  list(db: Database, userId: string): Promise<object[]>;
  save(db: Database, entity: object): Promise<void>;
  /** `undefined` = a entidade nao e excluida pelo app (a exclusao chega como `UNSUPPORTED`). */
  remove?: ((db: Database, userId: string, id: string) => Promise<void>) | undefined;
}

interface Versioned {
  readonly updatedAt: Date | null;
}

function codec<E extends object, R extends BackupRecord>(spec: {
  toRecord: (entity: E) => R;
  fromRecord: (record: R) => E;
  version?: (entity: E) => string | null;
  find: (db: Database, userId: string, id: string) => Promise<E | null>;
  list: (db: Database, userId: string) => Promise<E[]>;
  save: (db: Database, entity: E) => Promise<void>;
  remove?: (db: Database, userId: string, id: string) => Promise<void>;
}): SyncEntityCodec {
  return {
    toRecord: (entity) => spec.toRecord(entity as E),
    fromRecord: (record) => spec.fromRecord(record as R),
    version: (entity) => (spec.version ? spec.version(entity as E) : ((entity as Versioned).updatedAt?.toISOString() ?? null)),
    find: spec.find,
    list: spec.list,
    save: (db, entity) => spec.save(db, entity as E),
    remove: spec.remove,
  };
}

/** Codec de cada entidade sincronizada. */
export const SYNC_CODECS: Readonly<Record<SyncEntity, SyncEntityCodec>> = {
  category: codec({
    toRecord: mapper.toCategoryRecord,
    fromRecord: mapper.fromCategoryRecord,
    find: (db, u, id) => db.categories.findById(u, id),
    list: (db, u) => db.categories.listByUser(u),
    save: (db, e) => db.categories.save(e),
  }),
  account: codec({
    toRecord: mapper.toAccountRecord,
    fromRecord: mapper.fromAccountRecord,
    find: (db, u, id) => db.accounts.findById(u, id),
    list: (db, u) => db.accounts.listByUser(u),
    save: (db, e) => db.accounts.save(e),
    remove: (db, u, id) => db.accounts.delete(u, id),
  }),
  income: codec({
    toRecord: mapper.toIncomeRecord,
    fromRecord: mapper.fromIncomeRecord,
    find: (db, u, id) => db.incomes.findById(u, id),
    list: (db, u) => db.incomes.listByUser(u),
    save: (db, e) => db.incomes.save(e),
    remove: (db, u, id) => db.incomes.delete(u, id),
  }),
  fixedExpense: codec({
    toRecord: mapper.toFixedExpenseRecord,
    fromRecord: mapper.fromFixedExpenseRecord,
    find: (db, u, id) => db.fixedExpenses.findById(u, id),
    list: (db, u) => db.fixedExpenses.listByUser(u),
    save: (db, e) => db.fixedExpenses.save(e),
    remove: (db, u, id) => db.fixedExpenses.delete(u, id),
  }),
  spendingLimitPlan: codec({
    toRecord: mapper.toSpendingLimitPlanRecord,
    fromRecord: mapper.fromSpendingLimitPlanRecord,
    find: (db, u, id) => db.spendingLimitPlans.findById(u, id),
    list: (db, u) => db.spendingLimitPlans.listByUser(u),
    save: (db, e) => db.spendingLimitPlans.save(e),
    remove: (db, u, id) => db.spendingLimitPlans.delete(u, id),
  }),
  spendingLimit: codec({
    toRecord: mapper.toSpendingLimitRecord,
    fromRecord: mapper.fromSpendingLimitRecord,
    find: (db, u, id) => db.spendingLimits.findById(u, id),
    list: (db, u) => db.spendingLimits.listByUser(u),
    save: (db, e) => db.spendingLimits.save(e),
    remove: (db, u, id) => db.spendingLimits.delete(u, id),
  }),
  transactionSeries: codec({
    toRecord: mapper.toTransactionSeriesRecord,
    fromRecord: mapper.fromTransactionSeriesRecord,
    find: (db, u, id) => db.transactionSeries.findById(u, id),
    list: (db, u) => db.transactionSeries.listByUser(u),
    save: (db, e) => db.transactionSeries.save(e),
  }),
  transaction: codec({
    toRecord: mapper.toTransactionRecord,
    fromRecord: mapper.fromTransactionRecord,
    find: (db, u, id) => db.transactions.findById(u, id),
    list: (db, u) => db.transactions.listByUser(u),
    save: (db, e) => db.transactions.save(e),
    remove: (db, u, id) => db.transactions.delete(u, id),
  }),
  purchaseSimulation: codec({
    toRecord: mapper.toPurchaseSimulationRecord,
    fromRecord: mapper.fromPurchaseSimulationRecord,
    find: (db, u, id) => db.simulations.findById(u, id),
    list: (db, u) => db.simulations.listByUser(u),
    save: (db, e) => db.simulations.save(e),
    remove: (db, u, id) => db.simulations.delete(u, id),
  }),
  preRegistration: codec({
    toRecord: mapper.toPreRegistrationRecord,
    fromRecord: mapper.fromPreRegistrationRecord,
    find: (db, u, id) => db.preRegistrations.findById(u, id),
    list: (db, u) => db.preRegistrations.listByUser(u),
    save: (db, e) => db.preRegistrations.save(e),
    remove: (db, u, id) => db.preRegistrations.delete(u, id),
  }),
  preference: codec({
    toRecord: mapper.toPreferenceRecord,
    fromRecord: mapper.fromPreferenceRecord,
    version: (preference) => preference.updatedAt,
    find: (db, u, id) => db.preferences.preferences.get(u, id),
    list: (db, u) => db.preferences.preferences.list(u),
    // uso e origem sao locais do aparelho: o record que chega nao os conhece, entao preserva os daqui
    save: async (db, e) => {
      const previous = await db.preferences.preferences.get(e.userId, e.id);
      await db.preferences.preferences.save(
        previous === null
          ? e
          : { ...e, lastUsedAt: previous.lastUsedAt, sourceConversationId: previous.sourceConversationId, sourceMessageId: previous.sourceMessageId, sourceMessageRemoved: previous.sourceMessageRemoved },
      );
    },
    remove: (db, u, id) => db.preferences.preferences.delete(u, id),
  }),
  captureAttachment: codec({
    toRecord: mapper.toCaptureAttachmentRecord,
    fromRecord: mapper.fromCaptureAttachmentRecord,
    version: (attachment) => attachment.sha256,
    find: (db, u, id) => db.captureAttachments.findById(u, id),
    list: async (db, u) => {
      const pres = await db.preRegistrations.listByUser(u);
      return (await Promise.all(pres.map((pre) => db.captureAttachments.listByPreRegistration(u, pre.id)))).flat();
    },
    save: (db, e) => db.captureAttachments.save(e),
    remove: (db, u, id) => db.captureAttachments.delete(u, id),
  }),
  categorizationRule: codec({
    toRecord: mapper.toCategorizationRuleRecord,
    fromRecord: mapper.fromCategorizationRuleRecord,
    version: (rule) => rule.updatedAt,
    find: (db, u, id) => db.plans.rules.get(u, id),
    list: (db, u) => db.plans.rules.list(u),
    save: (db, e) => db.plans.rules.save(e),
    remove: (db, u, id) => db.plans.rules.delete(u, id),
  }),
};
