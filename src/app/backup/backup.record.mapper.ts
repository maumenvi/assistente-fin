import { PreRegistration } from '../../domain/pre-registration/pre.registration.entity.ts';
import { CaptureAttachment } from '../../domain/pre-registration/capture.attachment.entity.ts';
import { Account } from '../../domain/account/account.entity.ts';
import { Income } from '../../domain/income/income.entity.ts';
import { FixedExpense } from '../../domain/fixed-expense/fixed.expense.entity.ts';
import { SpendingLimit } from '../../domain/spending-limit/spending.limit.entity.ts';
import { SpendingLimitPlan } from '../../domain/spending-limit/spending.limit.plan.entity.ts';
import { Transaction } from '../../domain/transaction/transaction.entity.ts';
import { TransactionSeries } from '../../domain/transaction/transaction.series.entity.ts';
import { PurchaseSimulation } from '../../domain/simulation/simulation.entity.ts';
import { Money } from '../../domain/shared/money.value.object.ts';
import { Recurrence } from '../../domain/shared/recurrence.value.object.ts';
import { Month } from '../../domain/shared/month.value.object.ts';
import { Category } from '../../domain/category/category.entity.ts';
import { CategoryName } from '../../domain/category/category.name.value.object.ts';
import { type Preference } from '../../domain/preference/preference.ts';
import { type CategorizationRule } from '../../domain/plan/rule/categorization.rule.ts';
import { type PreferenceTopic } from '../../domain/preference/preference.topic.ts';
import {
  type BackupAccountRecord,
  type BackupCategoryRecord,
  type BackupIncomeRecord,
  type BackupFixedExpenseRecord,
  type BackupSpendingLimitRecord,
  type BackupSpendingLimitPlanRecord,
  type BackupTransactionSeriesRecord,
  type BackupTransactionRecord,
  type BackupPurchaseSimulationRecord,
  type BackupPreRegistrationRecord,
  type BackupCaptureAttachmentRecord,
  type BackupPreferenceRecord,
  type BackupCategorizationRuleRecord,
} from '../shared/backup.record.schema.ts';

/**
 * Traducao entidade <-> record de backup (RF-17, RF-18), nos dois sentidos - mesmo espirito
 * dos mappers de `database/prisma/mappers/`: `toXRecord` pro export, `fromXRecord` pro
 * import, sempre passando por `Entity.fromPersistence` na volta (defesa em profundidade,
 * CA-19/CA-20).
 */

export function toAccountRecord(account: Account): BackupAccountRecord {
  return {
    kind: 'account',
    id: account.id,
    userId: account.userId,
    name: account.name,
    accountKind: account.kind,
    openingBalanceCents: account.openingBalance.cents,
    currency: account.openingBalance.currency,
    archived: account.archived,
    ...(account.openingBalanceDate !== null ? { openingBalanceDate: account.openingBalanceDate.toISOString() } : {}),
    ...(account.creditLimit !== null ? { creditLimitCents: account.creditLimit.cents } : {}),
    ...(account.closingDay !== null ? { closingDay: account.closingDay } : {}),
    ...(account.dueDay !== null ? { dueDay: account.dueDay } : {}),
    ...(account.isBenefit ? { isBenefit: true } : {}),
  };
}

export function fromAccountRecord(record: BackupAccountRecord): Account {
  return Account.fromPersistence({
    id: record.id,
    userId: record.userId,
    name: record.name,
    kind: record.accountKind,
    openingBalance: Money.fromCents(record.openingBalanceCents, record.currency),
    archived: record.archived,
    openingBalanceDate: record.openingBalanceDate === undefined ? null : new Date(record.openingBalanceDate),
    creditLimit:
      record.creditLimitCents === undefined ? null : Money.fromCents(record.creditLimitCents, record.currency),
    closingDay: record.closingDay ?? null,
    dueDay: record.dueDay ?? null,
    isBenefit: record.isBenefit ?? false,
  });
}

export function toCategoryRecord(category: Category): BackupCategoryRecord {
  return {
    kind: 'category',
    id: category.id,
    userId: category.userId,
    name: category.name.value,
    isDefault: category.isDefault,
    ...(category.isSystemBalance ? { isSystemBalance: true } : {}),
    ...(category.isSystemOpeningBalance ? { isSystemOpeningBalance: true } : {}),
    ...(category.isSystemAdjustment ? { isSystemAdjustment: true } : {}),
    ...(category.isSystemTransfer ? { isSystemTransfer: true } : {}),
    ...(category.isSystemCardPayment ? { isSystemCardPayment: true } : {}),
  };
}

export function fromCategoryRecord(record: BackupCategoryRecord): Category {
  return Category.fromPersistence({
    id: record.id,
    userId: record.userId,
    name: CategoryName.create(record.name),
    isDefault: record.isDefault,
    isSystemBalance: record.isSystemBalance ?? false,
    isSystemOpeningBalance: record.isSystemOpeningBalance ?? false,
    isSystemAdjustment: record.isSystemAdjustment ?? false,
    isSystemTransfer: record.isSystemTransfer ?? false,
    isSystemCardPayment: record.isSystemCardPayment ?? false,
  });
}

export function toIncomeRecord(income: Income): BackupIncomeRecord {
  return {
    kind: 'income',
    id: income.id,
    userId: income.userId,
    date: income.date.toISOString(),
    amountCents: income.amount.cents,
    currency: income.amount.currency,
    source: income.source,
    recurrenceFrequency: income.recurrence.frequency,
    recurrenceEveryN: income.recurrence.everyN,
    recurrenceEndDate: income.recurrence.endDate ? income.recurrence.endDate.toISOString() : null,
    categoryId: income.categoryId,
    notes: income.notes,
    accountId: income.accountId ?? undefined,
  };
}

export function fromIncomeRecord(record: BackupIncomeRecord): Income {
  return Income.fromPersistence({
    id: record.id,
    userId: record.userId,
    date: new Date(record.date),
    amount: Money.fromCents(record.amountCents, record.currency),
    source: record.source,
    recurrence: Recurrence.create({
      frequency: record.recurrenceFrequency,
      everyN: record.recurrenceEveryN,
      endDate: record.recurrenceEndDate === null ? null : new Date(record.recurrenceEndDate),
    }),
    categoryId: record.categoryId,
    notes: record.notes,
    accountId: record.accountId,
  });
}

export function toFixedExpenseRecord(fixedExpense: FixedExpense): BackupFixedExpenseRecord {
  return {
    kind: 'fixedExpense',
    id: fixedExpense.id,
    userId: fixedExpense.userId,
    dueDay: fixedExpense.dueDay,
    expectedAmountCents: fixedExpense.expectedAmount.cents,
    currency: fixedExpense.expectedAmount.currency,
    categoryId: fixedExpense.categoryId,
    accountId: fixedExpense.accountId,
    paid: fixedExpense.paid,
    ...(fixedExpense.referenceMonth !== null ? { referenceMonth: fixedExpense.referenceMonth } : {}),
    ...(fixedExpense.description !== null ? { description: fixedExpense.description } : {}),
  };
}

export function fromFixedExpenseRecord(record: BackupFixedExpenseRecord): FixedExpense {
  return FixedExpense.fromPersistence({
    id: record.id,
    userId: record.userId,
    dueDay: record.dueDay,
    expectedAmount: Money.fromCents(record.expectedAmountCents, record.currency),
    categoryId: record.categoryId,
    accountId: record.accountId,
    paid: record.paid,
    referenceMonth: record.referenceMonth ?? null,
    description: record.description ?? null,
  });
}

export function toSpendingLimitRecord(spendingLimit: SpendingLimit): BackupSpendingLimitRecord {
  return {
    kind: 'spendingLimit',
    id: spendingLimit.id,
    userId: spendingLimit.userId,
    categoryId: spendingLimit.categoryId,
    period: { year: spendingLimit.period.year, month: spendingLimit.period.month },
    maxAmountCents: spendingLimit.maxAmount.cents,
    currency: spendingLimit.maxAmount.currency,
    definitionId: spendingLimit.definitionId ?? undefined,
  };
}

export function fromSpendingLimitRecord(record: BackupSpendingLimitRecord): SpendingLimit {
  return SpendingLimit.fromPersistence({
    id: record.id,
    userId: record.userId,
    categoryId: record.categoryId,
    period: Month.create(record.period),
    maxAmount: Money.fromCents(record.maxAmountCents, record.currency),
    definitionId: record.definitionId,
  });
}

export function toSpendingLimitPlanRecord(plan: SpendingLimitPlan): BackupSpendingLimitPlanRecord {
  return {
    kind: 'spendingLimitPlan',
    id: plan.id,
    userId: plan.userId,
    categoryId: plan.categoryId,
    maxAmountCents: plan.maxAmount.cents,
    currency: plan.maxAmount.currency,
    recurrenceFrequency: plan.recurrence.frequency,
    recurrenceEveryN: plan.recurrence.everyN,
    recurrenceEndDate: plan.recurrence.endDate ? plan.recurrence.endDate.toISOString() : null,
    createdAt: plan.createdAt.toISOString(),
  };
}

export function fromSpendingLimitPlanRecord(record: BackupSpendingLimitPlanRecord): SpendingLimitPlan {
  return SpendingLimitPlan.fromPersistence({
    id: record.id,
    userId: record.userId,
    categoryId: record.categoryId,
    maxAmount: Money.fromCents(record.maxAmountCents, record.currency),
    recurrence: Recurrence.create({
      frequency: record.recurrenceFrequency,
      everyN: record.recurrenceEveryN,
      endDate: record.recurrenceEndDate === null ? null : new Date(record.recurrenceEndDate),
    }),
    createdAt: new Date(record.createdAt),
  });
}

export function toTransactionSeriesRecord(series: TransactionSeries): BackupTransactionSeriesRecord {
  return {
    kind: 'transactionSeries',
    id: series.id,
    userId: series.userId,
    accountId: series.accountId,
    type: series.type,
    amountCents: series.amount.cents,
    currency: series.amount.currency,
    categoryId: series.categoryId,
    notes: series.notes,
    recurrenceFrequency: series.recurrence.frequency,
    recurrenceEveryN: series.recurrence.everyN,
    recurrenceAnchor: series.anchorDate.toISOString(),
    // uma serie sempre repete -> sempre tem endDate; o `?? anchor` so convence o compilador
    recurrenceEndDate: (series.recurrence.endDate ?? series.anchorDate).toISOString(),
  };
}

export function fromTransactionSeriesRecord(record: BackupTransactionSeriesRecord): TransactionSeries {
  return TransactionSeries.fromPersistence({
    id: record.id,
    userId: record.userId,
    accountId: record.accountId,
    type: record.type,
    amount: Money.fromCents(record.amountCents, record.currency),
    categoryId: record.categoryId,
    notes: record.notes,
    recurrence: Recurrence.create({
      frequency: record.recurrenceFrequency,
      everyN: record.recurrenceEveryN,
      endDate: new Date(record.recurrenceEndDate),
    }),
    anchorDate: new Date(record.recurrenceAnchor),
  });
}

export function toTransactionRecord(transaction: Transaction): BackupTransactionRecord {
  return {
    kind: 'transaction',
    id: transaction.id,
    userId: transaction.userId,
    date: transaction.date.toISOString(),
    amountCents: transaction.amount.cents,
    currency: transaction.amount.currency,
    type: transaction.type,
    categoryId: transaction.categoryId,
    accountId: transaction.accountId,
    notes: transaction.notes,
    // lancamento avulso nao carrega recorrencia no backup (spec 003, RF-16)
    ...(transaction.recurrence.repeats()
      ? {
          recurrenceFrequency: transaction.recurrence.frequency,
          recurrenceEveryN: transaction.recurrence.everyN,
          ...(transaction.recurrence.endDate
            ? { recurrenceEndDate: transaction.recurrence.endDate.toISOString() }
            : {}),
        }
      : {}),
    ...(transaction.seriesId !== null ? { seriesId: transaction.seriesId } : {}),
    ...(transaction.incomeId !== null ? { incomeId: transaction.incomeId } : {}),
    ...(transaction.installmentGroupId !== null
      ? {
          installmentGroupId: transaction.installmentGroupId,
          ...(transaction.installmentNumber !== null ? { installmentNumber: transaction.installmentNumber } : {}),
          ...(transaction.installmentTotal !== null ? { installmentTotal: transaction.installmentTotal } : {}),
        }
      : {}),
    ...(transaction.fixedExpenseId !== null ? { fixedExpenseId: transaction.fixedExpenseId } : {}),
    ...(transaction.transferGroupId !== null ? { transferGroupId: transaction.transferGroupId } : {}),
    ...(transaction.cardPaymentGroupId !== null ? { cardPaymentGroupId: transaction.cardPaymentGroupId } : {}),
  };
}

export function fromTransactionRecord(record: BackupTransactionRecord): Transaction {
  return Transaction.fromPersistence({
    id: record.id,
    userId: record.userId,
    date: new Date(record.date),
    amount: Money.fromCents(record.amountCents, record.currency),
    type: record.type,
    categoryId: record.categoryId,
    accountId: record.accountId,
    notes: record.notes,
    recurrence:
      record.recurrenceFrequency === undefined
        ? Recurrence.none()
        : Recurrence.create({
            frequency: record.recurrenceFrequency,
            everyN: record.recurrenceEveryN,
            endDate: record.recurrenceEndDate === undefined ? null : new Date(record.recurrenceEndDate),
          }),
    seriesId: record.seriesId ?? null,
    incomeId: record.incomeId ?? null,
    installmentGroupId: record.installmentGroupId ?? null,
    installmentNumber: record.installmentNumber ?? null,
    installmentTotal: record.installmentTotal ?? null,
    fixedExpenseId: record.fixedExpenseId ?? null,
    transferGroupId: record.transferGroupId ?? null,
    cardPaymentGroupId: record.cardPaymentGroupId ?? null,
  });
}

export function toPurchaseSimulationRecord(
  simulation: PurchaseSimulation,
): BackupPurchaseSimulationRecord {
  return {
    kind: 'purchaseSimulation',
    id: simulation.id,
    userId: simulation.userId,
    amountCents: simulation.amount.cents,
    currency: simulation.amount.currency,
    date: simulation.date.toISOString(),
    categoryId: simulation.categoryId,
    payment: simulation.payment,
    installments: simulation.installments,
    recurrenceFrequency: simulation.recurrence.frequency,
    recurrenceEveryN: simulation.recurrence.everyN,
    recurrenceEndDate: simulation.recurrence.endDate ? simulation.recurrence.endDate.toISOString() : null,
    accountId: simulation.accountId,
    approvedAt: simulation.approvedAt ? simulation.approvedAt.toISOString() : null,
  };
}

export function fromPurchaseSimulationRecord(
  record: BackupPurchaseSimulationRecord,
): PurchaseSimulation {
  return PurchaseSimulation.fromPersistence({
    id: record.id,
    userId: record.userId,
    amount: Money.fromCents(record.amountCents, record.currency),
    date: new Date(record.date),
    categoryId: record.categoryId,
    payment: record.payment,
    installments: record.installments,
    recurrence: Recurrence.create({
      frequency: record.recurrenceFrequency,
      everyN: record.recurrenceEveryN,
      endDate: record.recurrenceEndDate === null ? null : new Date(record.recurrenceEndDate),
    }),
    accountId: record.accountId,
    approvedAt: record.approvedAt ? new Date(record.approvedAt) : null,
  });
}

/** Pre-registro -> record (spec 022, backup v3). */
export function toPreRegistrationRecord(pre: PreRegistration): BackupPreRegistrationRecord {
  return {
    kind: 'preRegistration',
    id: pre.id,
    userId: pre.userId,
    origin: pre.origin,
    ...(pre.amount !== null ? { amountCents: pre.amount.cents, currency: pre.amount.currency } : {}),
    ...(pre.description !== null ? { description: pre.description } : {}),
    ...(pre.date !== null ? { date: pre.date.toISOString() } : {}),
    ...(pre.accountId !== null ? { accountId: pre.accountId } : {}),
    ...(pre.paymentMethod !== null ? { paymentMethod: pre.paymentMethod } : {}),
    ...(pre.installments !== null ? { installments: pre.installments } : {}),
    ...(pre.categoryId !== null ? { categoryId: pre.categoryId } : {}),
    ...(pre.notes !== null ? { notes: pre.notes } : {}),
    needsReview: pre.needsReview,
    manualOnly: pre.manualOnly,
    ...(pre.dedupKey !== null ? { dedupKey: pre.dedupKey } : {}),
    ...(pre.possibleDuplicateOf !== null ? { possibleDuplicateOf: pre.possibleDuplicateOf } : {}),
    ...(pre.duplicateReviewed ? { duplicateReviewed: true } : {}),
    ...(pre.sourceDevice !== null ? { sourceDevice: pre.sourceDevice } : {}),
    createdAt: pre.createdAt.toISOString(),
  };
}

/** Record -> pre-registro (spec 022, backup v3). */
export function fromPreRegistrationRecord(record: BackupPreRegistrationRecord): PreRegistration {
  return PreRegistration.fromPersistence({
    id: record.id,
    userId: record.userId,
    origin: record.origin,
    amount: record.amountCents === undefined ? null : Money.fromCents(record.amountCents, record.currency ?? 'BRL'),
    description: record.description ?? null,
    date: record.date === undefined ? null : new Date(record.date),
    accountId: record.accountId ?? null,
    paymentMethod: record.paymentMethod ?? null,
    installments: record.installments ?? null,
    categoryId: record.categoryId ?? null,
    notes: record.notes ?? null,
    needsReview: record.needsReview,
    manualOnly: record.manualOnly,
    dedupKey: record.dedupKey ?? null,
    possibleDuplicateOf: record.possibleDuplicateOf ?? null,
    duplicateReviewed: record.duplicateReviewed ?? false,
    sourceDevice: record.sourceDevice ?? null,
    createdAt: new Date(record.createdAt),
  });
}

/** Anexo -> record (spec 022, backup v3). A imagem em si nao viaja aqui (so a referencia). */
export function toCaptureAttachmentRecord(attachment: CaptureAttachment): BackupCaptureAttachmentRecord {
  return {
    kind: 'captureAttachment',
    id: attachment.id,
    userId: attachment.userId,
    preRegistrationId: attachment.preRegistrationId,
    attachmentKind: attachment.kind,
    ...(attachment.mimeType !== null ? { mimeType: attachment.mimeType } : {}),
    ...(attachment.content !== null ? { content: attachment.content } : {}),
    ...(attachment.fileRef !== null ? { fileRef: attachment.fileRef } : {}),
    sha256: attachment.sha256,
    createdAt: attachment.createdAt.toISOString(),
  };
}

/** Record -> anexo (spec 022, backup v3). */
export function fromCaptureAttachmentRecord(record: BackupCaptureAttachmentRecord): CaptureAttachment {
  return CaptureAttachment.fromPersistence({
    id: record.id,
    userId: record.userId,
    preRegistrationId: record.preRegistrationId,
    kind: record.attachmentKind,
    mimeType: record.mimeType ?? null,
    content: record.content ?? null,
    fileRef: record.fileRef ?? null,
    sha256: record.sha256,
    createdAt: new Date(record.createdAt),
  });
}

/** Preferencia -> record (spec 032, backup v4). `lastUsedAt` e a origem ficam locais, fora do record. */
export function toPreferenceRecord(p: Preference): BackupPreferenceRecord {
  return {
    kind: 'preference',
    id: p.id,
    userId: p.userId,
    text: p.text,
    topic: p.topic,
    scope: p.scope,
    origin: p.origin,
    status: p.status,
    effect: p.effect,
    private: p.private,
    confidence: p.confidence,
    evidence: p.evidence,
    supersededBy: p.supersededBy,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}

/** Record -> preferencia (spec 032). Campos locais nascem vazios; quem grava preserva os do aparelho. */
export function fromPreferenceRecord(record: BackupPreferenceRecord): Preference {
  return {
    id: record.id,
    userId: record.userId,
    text: record.text,
    topic: record.topic as PreferenceTopic,
    scope: record.scope,
    origin: record.origin,
    status: record.status,
    effect: record.effect,
    private: record.private,
    confidence: record.confidence,
    evidence: record.evidence,
    supersededBy: record.supersededBy,
    createdAt: new Date(record.createdAt).toISOString(),
    updatedAt: new Date(record.updatedAt).toISOString(),
    lastUsedAt: null,
    sourceConversationId: null,
    sourceMessageId: null,
    sourceMessageRemoved: false,
  };
}

/** Regra de categorizacao -> record (spec 033, backup v5). */
export function toCategorizationRuleRecord(r: CategorizationRule): BackupCategorizationRuleRecord {
  return { kind: 'categorizationRule', id: r.id, userId: r.userId, merchant: r.merchant, categoryId: r.categoryId, origin: r.origin, confidence: r.confidence, evidence: r.evidence, createdAt: r.createdAt, updatedAt: r.updatedAt };
}

/** Record -> regra de categorizacao (spec 033). */
export function fromCategorizationRuleRecord(record: BackupCategorizationRuleRecord): CategorizationRule {
  return {
    id: record.id,
    userId: record.userId,
    merchant: record.merchant,
    categoryId: record.categoryId,
    origin: record.origin,
    confidence: record.confidence,
    evidence: record.evidence,
    createdAt: new Date(record.createdAt).toISOString(),
    updatedAt: new Date(record.updatedAt).toISOString(),
  };
}
