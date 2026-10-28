import { type Database } from '../shared/database.port.ts';
import { BACKUP_SCHEMA_VERSION, type BackupRecord } from '../shared/backup.record.schema.ts';
import {
  toAccountRecord,
  toCategoryRecord,
  toIncomeRecord,
  toFixedExpenseRecord,
  toSpendingLimitPlanRecord,
  toSpendingLimitRecord,
  toTransactionSeriesRecord,
  toTransactionRecord,
  toPurchaseSimulationRecord,
  toPreRegistrationRecord,
  toCaptureAttachmentRecord,
  toPreferenceRecord,
  toCategorizationRuleRecord,
} from './backup.record.mapper.ts';

/**
 * Gera o stream de `BackupRecord` de um usuario (spec 001, RF-17) - extraido de
 * `ExportBackupUseCase` na Fase 0.5 pra `ApplyScenario` reusar ao montar o snapshot.
 *
 * Ordem: `header` -> `category` -> `account` -> `income` -> `fixedExpense` ->
 * `spendingLimitPlan` -> `spendingLimit` -> `transactionSeries` -> `transaction` ->
 * `purchaseSimulation`. Categorias e contas vem antes de quem as referencia
 * (`categoryId`/`accountId`); a serie vem antes das ocorrencias que a apontam por `seriesId`;
 * o plano vem antes dos limites que o referenciam por `definitionId` (spec 016). Assim
 * importa num unico passe. As preferencias (spec 032) so entram com `options.preferences`. Cada `listByUser` carrega a colecao daquele tipo em memoria, uma
 * de cada vez.
 */
export async function* streamBackupRecords(
  database: Database,
  userId: string,
  exportedAt: Date,
  options: { readonly preferences?: boolean; readonly rules?: boolean } = {},
): AsyncGenerator<BackupRecord> {
  yield {
    kind: 'header',
    schemaVersion: BACKUP_SCHEMA_VERSION,
    userId,
    exportedAt: exportedAt.toISOString(),
  };

  for (const category of await database.categories.listByUser(userId)) {
    yield toCategoryRecord(category);
  }
  for (const account of await database.accounts.listByUser(userId)) {
    yield toAccountRecord(account);
  }
  for (const income of await database.incomes.listByUser(userId)) {
    yield toIncomeRecord(income);
  }
  for (const fixedExpense of await database.fixedExpenses.listByUser(userId)) {
    yield toFixedExpenseRecord(fixedExpense);
  }
  for (const plan of await database.spendingLimitPlans.listByUser(userId)) {
    yield toSpendingLimitPlanRecord(plan);
  }
  for (const spendingLimit of await database.spendingLimits.listByUser(userId)) {
    yield toSpendingLimitRecord(spendingLimit);
  }
  for (const series of await database.transactionSeries.listByUser(userId)) {
    yield toTransactionSeriesRecord(series);
  }
  for (const transaction of await database.transactions.listByUser(userId)) {
    yield toTransactionRecord(transaction);
  }
  for (const simulation of await database.simulations.listByUser(userId)) {
    yield toPurchaseSimulationRecord(simulation);
  }
  // spec 022 (backup v3): pre-registros pendentes e seus anexos (texto; imagem so por referencia)
  for (const pre of await database.preRegistrations.listByUser(userId)) {
    yield toPreRegistrationRecord(pre);
    for (const attachment of await database.captureAttachments.listByPreRegistration(userId, pre.id)) {
      yield toCaptureAttachmentRecord(attachment);
    }
  }
  // spec 032 (backup v4): preferencias do agente, depois de contas e categorias (o escopo as cita).
  // So no backup completo - o snapshot de cenario nao carrega nem restaura preferencias.
  if (options.preferences === true) {
    for (const preference of await database.preferences.preferences.list(userId)) {
      yield toPreferenceRecord(preference);
    }
  }
  // spec 033 (backup v5): regras de categorizacao, depois das categorias que citam. So no backup completo.
  if (options.rules === true) {
    for (const rule of await database.plans.rules.list(userId)) {
      yield toCategorizationRuleRecord(rule);
    }
  }
}
