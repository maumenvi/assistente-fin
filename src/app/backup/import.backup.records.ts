import { InvalidBackupError } from '../../domain/backup/invalid.backup.error.ts';
import { type Database } from '../shared/database.port.ts';
import { SUPPORTED_BACKUP_SCHEMA_VERSIONS, backupRecordSchema, type BackupRecord } from '../shared/backup.record.schema.ts';
import {
  fromAccountRecord,
  fromCategoryRecord,
  fromIncomeRecord,
  fromFixedExpenseRecord,
  fromSpendingLimitPlanRecord,
  fromSpendingLimitRecord,
  fromTransactionSeriesRecord,
  fromTransactionRecord,
  fromPurchaseSimulationRecord,
  fromPreRegistrationRecord,
  fromCaptureAttachmentRecord,
} from './backup.record.mapper.ts';

/** Quantos registros de cada tipo foram gravados (RF-18, CA-16). */
export interface ImportReport {
  readonly categories: number;
  readonly accounts: number;
  readonly incomes: number;
  readonly fixedExpenses: number;
  readonly spendingLimits: number;
  readonly spendingLimitPlans: number;
  readonly transactionSeries: number;
  readonly transactions: number;
  readonly purchaseSimulations: number;
  readonly preRegistrations: number;
  readonly captureAttachments: number;
}

/**
 * Consome um stream de records de backup e grava tudo em `tx` (spec 001, RF-18, CA-16,
 * CA-17) - extraido de `ImportBackupUseCase` na Fase 0.5 pra `RestoreDataSnapshot` reusar.
 *
 * NAO abre transacao nem checa usuario/verificacao - o chamador faz isso e passa o `tx`.
 * Valida cada record com zod conforme chega; qualquer coisa fora do lugar (forma invalida,
 * header ausente/duplicado, versao incompativel, dado de outro usuario) lanca
 * `InvalidBackupError` e o chamador desfaz a transacao. Idempotente: cada `save` e upsert
 * por id.
 */
/** Opcoes da importacao. */
export interface ImportBackupOptions {
  /**
   * Aceita um backup de OUTRO aparelho/instalacao (spec 022, FR-007): o usuario do arquivo nao
   * existe neste banco, e os registros passam a pertencer a `userId`. Sem esta opcao, backup de
   * outro usuario continua recusado (spec 001, RF-16). Um usuario que exista neste banco nunca
   * e adotado.
   */
  readonly adoptForeignBackup?: boolean | undefined;
}

export async function importBackupRecords(
  tx: Database,
  userId: string,
  records: AsyncIterable<unknown> | Iterable<unknown>,
  options: ImportBackupOptions = {},
): Promise<ImportReport> {
  const report = emptyImportReport();
  let headerSeen = false;
  let foreignUserId: string | null = null;

  for await (const raw of records) {
    const parsed = backupRecordSchema.safeParse(adoptRecord(raw, foreignUserId, userId));
    if (!parsed.success) {
      throw new InvalidBackupError('registro com forma invalida');
    }
    const record = parsed.data;

    if (record.kind === 'header' && !headerSeen && record.userId !== userId && options.adoptForeignBackup === true) {
      if (await tx.users.findById(record.userId)) {
        throw new InvalidBackupError('backup contem dado de outro usuario deste banco');
      }
      foreignUserId = record.userId;
    } else if (record.userId !== userId) {
      throw new InvalidBackupError('backup contem dado de outro usuario');
    }

    if (record.kind === 'header') {
      if (headerSeen) {
        throw new InvalidBackupError('backup com mais de um header');
      }
      if (!SUPPORTED_BACKUP_SCHEMA_VERSIONS.includes(record.schemaVersion)) {
        throw new InvalidBackupError(`versao de schema incompativel: ${record.schemaVersion}`);
      }
      headerSeen = true;
      continue;
    }
    report[await saveBackupRecord(tx, record)] += 1;
  }

  if (!headerSeen) {
    throw new InvalidBackupError('backup sem header');
  }

  return report;
}

/** Troca o dono de um record do usuario adotado pelo usuario da sessao (ver `adoptForeignBackup`). */
function adoptRecord(raw: unknown, foreignUserId: string | null, userId: string): unknown {
  if (foreignUserId === null || typeof raw !== 'object' || raw === null) return raw;
  const record = raw as Record<string, unknown>;
  return record['userId'] === foreignUserId && record['kind'] !== 'header' ? { ...record, userId } : raw;
}

/** Chave do `ImportReport` de cada tipo de record. */
type ReportKey = keyof ImportReport;

/** Grava UM record (upsert por id) pelo repositorio do tipo; devolve a chave do relatorio. */
export async function saveBackupRecord(tx: Database, record: Exclude<BackupRecord, { kind: 'header' }>): Promise<ReportKey> {
  switch (record.kind) {
    case 'category':
      await tx.categories.save(fromCategoryRecord(record));
      return 'categories';
    case 'account':
      await tx.accounts.save(fromAccountRecord(record));
      return 'accounts';
    case 'income':
      await tx.incomes.save(fromIncomeRecord(record));
      return 'incomes';
    case 'fixedExpense':
      await tx.fixedExpenses.save(fromFixedExpenseRecord(record));
      return 'fixedExpenses';
    case 'spendingLimitPlan':
      await tx.spendingLimitPlans.save(fromSpendingLimitPlanRecord(record));
      return 'spendingLimitPlans';
    case 'spendingLimit':
      await tx.spendingLimits.save(fromSpendingLimitRecord(record));
      return 'spendingLimits';
    case 'transactionSeries':
      await tx.transactionSeries.save(fromTransactionSeriesRecord(record));
      return 'transactionSeries';
    case 'transaction':
      await tx.transactions.save(fromTransactionRecord(record));
      return 'transactions';
    case 'purchaseSimulation':
      await tx.simulations.save(fromPurchaseSimulationRecord(record));
      return 'purchaseSimulations';
    case 'preRegistration':
      await tx.preRegistrations.save(fromPreRegistrationRecord(record));
      return 'preRegistrations';
    case 'captureAttachment':
      await tx.captureAttachments.save(fromCaptureAttachmentRecord(record));
      return 'captureAttachments';
  }
}

/** Relatorio zerado. */
export function emptyImportReport(): { -readonly [K in keyof ImportReport]: number } {
  return {
    categories: 0,
    accounts: 0,
    incomes: 0,
    fixedExpenses: 0,
    spendingLimits: 0,
    spendingLimitPlans: 0,
    transactionSeries: 0,
    transactions: 0,
    purchaseSimulations: 0,
    preRegistrations: 0,
    captureAttachments: 0,
  };
}

/**
 * Le e valida todos os records de um arquivo (spec 022, T143) com as MESMAS regras do import:
 * header unico e suportado, forma de cada record, dono = `userId` (ou adocao de backup de outro
 * aparelho). Devolve o header e os demais records ja com o `userId` da sessao.
 */
export async function readBackupRecords(
  tx: Database,
  userId: string,
  records: AsyncIterable<unknown> | Iterable<unknown>,
  options: ImportBackupOptions = {},
): Promise<{ header: Extract<BackupRecord, { kind: 'header' }>; records: Exclude<BackupRecord, { kind: 'header' }>[] }> {
  let header: Extract<BackupRecord, { kind: 'header' }> | null = null;
  let foreignUserId: string | null = null;
  const out: Exclude<BackupRecord, { kind: 'header' }>[] = [];
  for await (const raw of records) {
    const parsed = backupRecordSchema.safeParse(adoptRecord(raw, foreignUserId, userId));
    if (!parsed.success) throw new InvalidBackupError('registro com forma invalida');
    const record = parsed.data;
    if (record.kind === 'header') {
      if (header !== null) throw new InvalidBackupError('backup com mais de um header');
      if (!SUPPORTED_BACKUP_SCHEMA_VERSIONS.includes(record.schemaVersion)) {
        throw new InvalidBackupError(`versao de schema incompativel: ${record.schemaVersion}`);
      }
      if (record.userId !== userId) {
        if (options.adoptForeignBackup !== true) throw new InvalidBackupError('backup contem dado de outro usuario');
        if (await tx.users.findById(record.userId)) throw new InvalidBackupError('backup contem dado de outro usuario deste banco');
        foreignUserId = record.userId;
      }
      header = record;
      continue;
    }
    if (header === null) throw new InvalidBackupError('backup sem header');
    if (record.userId !== userId) throw new InvalidBackupError('backup contem dado de outro usuario');
    out.push(record);
  }
  if (header === null) throw new InvalidBackupError('backup sem header');
  return { header, records: out };
}
