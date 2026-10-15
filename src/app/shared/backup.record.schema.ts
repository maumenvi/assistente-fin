import { z } from 'zod';
import { ACCOUNT_KINDS } from '../../domain/account/account.kind.ts';
import { RECURRENCE_FREQUENCIES } from '../../domain/shared/recurrence.frequency.ts';
import { TRANSACTION_TYPES } from '../../domain/transaction/transaction.type.ts';
import { PAYMENT_METHODS } from '../../domain/simulation/payment.method.ts';
import { PRE_REGISTRATION_ORIGINS } from '../../domain/pre-registration/pre.registration.origin.ts';
import { CAPTURE_ATTACHMENT_KINDS } from '../../domain/pre-registration/capture.attachment.kind.ts';

/**
 * Versao do formato de backup (RF-17, RF-18) - todo record carrega a mesma no campo
 * `schemaVersion` (comeca no `header`); `ImportBackupUseCase` rejeita qualquer valor
 * diferente (`InvalidBackupError`) em vez de tentar migrar formatos antigos nesta entrega.
 */
export const BACKUP_SCHEMA_VERSION = 3;

/** Versoes que o importador ainda aceita (v2 = sem pre-registros, spec 022). */
export const SUPPORTED_BACKUP_SCHEMA_VERSIONS: readonly number[] = [2, 3];

/** Datas do backup viajam como string ISO (JSON nao tem tipo `Date`). */
const dateStringSchema = z.iso.datetime({ offset: true }).or(z.iso.date());

/** So `BRL` suportado por ora (domain/shared/currency.ts) - mesma limitacao em todo o dominio. */
const currencySchema = z.literal('BRL');

/**
 * Primeiro record de todo backup (RF-17, CA-15): identifica o usuario e a versao do
 * formato antes de qualquer entidade. `schemaVersion` so precisa ser um inteiro positivo
 * aqui (forma) - comparar com `BACKUP_SCHEMA_VERSION` (conteudo, incompatibilidade) e
 * responsabilidade de `ImportBackupUseCase`, que pode dar uma mensagem melhor do que um
 * erro de forma generico.
 */
const backupHeaderRecordSchema = z.object({
  kind: z.literal('header'),
  schemaVersion: z.int().positive(),
  userId: z.string().trim().min(1),
  exportedAt: dateStringSchema,
  /** Backup por periodo (spec 022, FR-016): intervalo exportado. Ausente = backup completo. */
  scope: z.object({ from: z.iso.date(), to: z.iso.date() }).optional(),
});

const backupAccountRecordSchema = z.object({
  kind: z.literal('account'),
  id: z.string().trim().min(1),
  userId: z.string().trim().min(1),
  name: z.string().trim().min(1),
  /** Campo do dominio chama-se `kind` no `Account` - renomeado aqui pra nao colidir com o
   *  discriminante `kind: 'account'` do record. */
  accountKind: z.enum(ACCOUNT_KINDS),
  openingBalanceCents: z.int(),
  currency: currencySchema,
  archived: z.boolean(),
  /** Campos das specs 008/016+ (cartao, beneficio, data do saldo inicial). Opcionais: um
   *  backup antigo sem eles continua importavel (spec 022, compatibilidade celular<->desktop). */
  openingBalanceDate: dateStringSchema.optional(),
  creditLimitCents: z.int().optional(),
  closingDay: z.int().min(1).max(31).optional(),
  dueDay: z.int().min(1).max(31).optional(),
  isBenefit: z.boolean().optional(),
});

/**
 * Categoria do usuario (spec 003, RF-6). Vem no stream **antes** dos lancamentos, porque
 * todos eles referenciam `categoryId` - importar na ordem inversa deixaria vinculo pendurado.
 */
const backupCategoryRecordSchema = z.object({
  kind: z.literal('category'),
  id: z.string().trim().min(1),
  userId: z.string().trim().min(1),
  name: z.string().trim().min(1),
  isDefault: z.boolean(),
  /** Marcas das categorias de sistema (specs 016/018). Opcionais por compatibilidade. */
  isSystemBalance: z.boolean().optional(),
  isSystemOpeningBalance: z.boolean().optional(),
  isSystemAdjustment: z.boolean().optional(),
  isSystemTransfer: z.boolean().optional(),
  isSystemCardPayment: z.boolean().optional(),
});

const backupIncomeRecordSchema = z.object({
  kind: z.literal('income'),
  id: z.string().trim().min(1),
  userId: z.string().trim().min(1),
  date: dateStringSchema,
  amountCents: z.int(),
  currency: currencySchema,
  source: z.string().trim().min(1),
  recurrenceFrequency: z.enum(RECURRENCE_FREQUENCIES),
  recurrenceEveryN: z.int().min(1),
  recurrenceEndDate: dateStringSchema.nullable(),
  categoryId: z.string().trim().min(1),
  notes: z.string().trim().optional(),
  /**
   * Conta vinculada (spec 012, RF-1). Ausente = ganho sem conta (simulacao de cenario ou
   * registro anterior a esta feature) - aditivo, backups antigos sem o campo continuam
   * importaveis (`.optional()` tolera ausencia).
   */
  accountId: z.string().trim().min(1).optional(),
});

const backupFixedExpenseRecordSchema = z.object({
  kind: z.literal('fixedExpense'),
  id: z.string().trim().min(1),
  userId: z.string().trim().min(1),
  dueDay: z.int().min(1).max(31),
  expectedAmountCents: z.int(),
  currency: currencySchema,
  categoryId: z.string().trim().min(1),
  accountId: z.string().trim().min(1),
  paid: z.boolean(),
  referenceMonth: z.int().min(1).max(12).optional(),
  description: z.string().trim().optional(),
});

const backupSpendingLimitRecordSchema = z.object({
  kind: z.literal('spendingLimit'),
  id: z.string().trim().min(1),
  userId: z.string().trim().min(1),
  categoryId: z.string().trim().min(1),
  period: z.object({ year: z.int(), month: z.int().min(1).max(12) }),
  maxAmountCents: z.int(),
  currency: currencySchema,
  /**
   * Plano de origem (spec 016); ausente = limite criado manualmente (caminho antigo).
   * Aditivo - backups antigos sem o campo continuam importaveis.
   */
  definitionId: z.string().trim().min(1).optional(),
});

/**
 * Plano (definicao recorrente) de limite de gasto (spec 016). Vem no stream **antes** dos
 * `spendingLimit`, porque estes podem referenciar `definitionId`.
 */
const backupSpendingLimitPlanRecordSchema = z.object({
  kind: z.literal('spendingLimitPlan'),
  id: z.string().trim().min(1),
  userId: z.string().trim().min(1),
  categoryId: z.string().trim().min(1),
  maxAmountCents: z.int(),
  currency: currencySchema,
  recurrenceFrequency: z.enum(RECURRENCE_FREQUENCIES),
  recurrenceEveryN: z.int().min(1),
  recurrenceEndDate: dateStringSchema.nullable(),
  createdAt: dateStringSchema,
});

const backupTransactionRecordSchema = z.object({
  kind: z.literal('transaction'),
  id: z.string().trim().min(1),
  userId: z.string().trim().min(1),
  date: dateStringSchema,
  amountCents: z.int(),
  currency: currencySchema,
  type: z.enum(TRANSACTION_TYPES),
  /** Categoria do lancamento (spec 003, RF-10) - sempre presente, mesmo que seja a padrao. */
  categoryId: z.string().trim().min(1),
  accountId: z.string().trim().min(1),
  notes: z.string().trim().optional(),
  /** Recorrencia (spec 003, RF-16). Ausente = lancamento avulso (`nao-repete`). */
  recurrenceFrequency: z.enum(RECURRENCE_FREQUENCIES).optional(),
  recurrenceEveryN: z.int().min(1).optional(),
  recurrenceEndDate: dateStringSchema.optional(),
  /** Serie que gerou a ocorrencia (spec 003, RF-26); ausente = avulsa ou desanexada. */
  seriesId: z.string().trim().min(1).optional(),
  /**
   * Ganho de origem (spec 012, RF-3/RF-5, Q2); ausente = transacao sem vinculo com nenhum
   * Income (a maioria). Aditivo - backups antigos sem o campo continuam importaveis.
   */
  incomeId: z.string().trim().min(1).optional(),
  /** Parcelas (spec 009), gasto fixo pago (spec 015), transferencia e pagamento de cartao
   *  (spec 016). Opcionais por compatibilidade com backups antigos (spec 022). */
  installmentGroupId: z.string().trim().min(1).optional(),
  installmentNumber: z.int().min(1).optional(),
  installmentTotal: z.int().min(1).optional(),
  fixedExpenseId: z.string().trim().min(1).optional(),
  transferGroupId: z.string().trim().min(1).optional(),
  cardPaymentGroupId: z.string().trim().min(1).optional(),
});

/**
 * Serie de transacoes recorrentes (spec 003, RF-25) - o "molde" de um lancamento manual
 * recorrente. Vem no stream **antes** das transactions, porque as ocorrencias referenciam
 * `seriesId`. `recurrenceEndDate` nao e nulavel: uma serie sempre repete (frequencia !=
 * `nao-repete`) e portanto sempre tem data final.
 */
const backupTransactionSeriesRecordSchema = z.object({
  kind: z.literal('transactionSeries'),
  id: z.string().trim().min(1),
  userId: z.string().trim().min(1),
  accountId: z.string().trim().min(1),
  type: z.enum(TRANSACTION_TYPES),
  amountCents: z.int(),
  currency: currencySchema,
  categoryId: z.string().trim().min(1),
  notes: z.string().trim().optional(),
  recurrenceFrequency: z.enum(RECURRENCE_FREQUENCIES),
  recurrenceEveryN: z.int().min(1),
  recurrenceAnchor: dateStringSchema,
  recurrenceEndDate: dateStringSchema,
});

const backupPurchaseSimulationRecordSchema = z.object({
  kind: z.literal('purchaseSimulation'),
  id: z.string().trim().min(1),
  userId: z.string().trim().min(1),
  amountCents: z.int(),
  currency: currencySchema,
  date: dateStringSchema,
  categoryId: z.string().trim().min(1),
  payment: z.enum(PAYMENT_METHODS),
  installments: z.int().min(1),
  recurrenceFrequency: z.enum(RECURRENCE_FREQUENCIES),
  recurrenceEveryN: z.int().min(1),
  recurrenceEndDate: dateStringSchema.nullable(),
  accountId: z.string().trim().min(1),
  approvedAt: dateStringSchema.nullable(),
});

/**
 * Um record do backup (RF-17, RF-18) - a unidade que trafega no stream de
 * `ExportBackupUseCase`/`ImportBackupUseCase` (decisao do usuario: streaming em vez de um
 * unico JSON, pra nao exigir carregar tudo em memoria de um lado nem do outro). Discriminado
 * por `kind`; `VerificationCode` fica de fora de proposito (efemero, nao faz sentido
 * restaurar um codigo OTP expirado - pedir um novo e mais simples e mais seguro).
 */
/** Pre-registro (spec 022, backup v3): compra anotada ainda nao aprovada. */
const backupPreRegistrationRecordSchema = z.object({
  kind: z.literal('preRegistration'),
  id: z.string().trim().min(1),
  userId: z.string().trim().min(1),
  origin: z.enum(PRE_REGISTRATION_ORIGINS),
  amountCents: z.int().positive().optional(),
  currency: currencySchema.optional(),
  description: z.string().trim().optional(),
  date: dateStringSchema.optional(),
  accountId: z.string().trim().min(1).optional(),
  paymentMethod: z.enum(PAYMENT_METHODS).optional(),
  installments: z.int().min(1).max(48).optional(),
  categoryId: z.string().trim().min(1).optional(),
  notes: z.string().trim().optional(),
  needsReview: z.boolean(),
  manualOnly: z.boolean(),
  dedupKey: z.string().trim().min(1).optional(),
  possibleDuplicateOf: z.string().trim().min(1).optional(),
  duplicateReviewed: z.boolean().optional(),
  sourceDevice: z.string().trim().min(1).optional(),
  createdAt: dateStringSchema,
});

/** Anexo de captura (spec 022, backup v3). Imagem so viaja com `imageBase64` (opcional). */
const backupCaptureAttachmentRecordSchema = z.object({
  kind: z.literal('captureAttachment'),
  id: z.string().trim().min(1),
  userId: z.string().trim().min(1),
  preRegistrationId: z.string().trim().min(1),
  attachmentKind: z.enum(CAPTURE_ATTACHMENT_KINDS),
  mimeType: z.string().trim().min(1).optional(),
  content: z.string().optional(),
  fileRef: z.string().trim().min(1).optional(),
  imageBase64: z.string().optional(),
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
  createdAt: dateStringSchema,
});

export const backupRecordSchema = z.discriminatedUnion('kind', [
  backupHeaderRecordSchema,
  backupAccountRecordSchema,
  backupCategoryRecordSchema,
  backupIncomeRecordSchema,
  backupFixedExpenseRecordSchema,
  backupSpendingLimitPlanRecordSchema,
  backupSpendingLimitRecordSchema,
  backupTransactionSeriesRecordSchema,
  backupTransactionRecordSchema,
  backupPurchaseSimulationRecordSchema,
  backupPreRegistrationRecordSchema,
  backupCaptureAttachmentRecordSchema,
]);

export type BackupRecord = z.infer<typeof backupRecordSchema>;
export type BackupHeaderRecord = z.infer<typeof backupHeaderRecordSchema>;
export type BackupAccountRecord = z.infer<typeof backupAccountRecordSchema>;
export type BackupCategoryRecord = z.infer<typeof backupCategoryRecordSchema>;
export type BackupIncomeRecord = z.infer<typeof backupIncomeRecordSchema>;
export type BackupFixedExpenseRecord = z.infer<typeof backupFixedExpenseRecordSchema>;
export type BackupSpendingLimitRecord = z.infer<typeof backupSpendingLimitRecordSchema>;
export type BackupSpendingLimitPlanRecord = z.infer<typeof backupSpendingLimitPlanRecordSchema>;
export type BackupTransactionSeriesRecord = z.infer<typeof backupTransactionSeriesRecordSchema>;
export type BackupTransactionRecord = z.infer<typeof backupTransactionRecordSchema>;
export type BackupPurchaseSimulationRecord = z.infer<typeof backupPurchaseSimulationRecordSchema>;
export type BackupPreRegistrationRecord = z.infer<typeof backupPreRegistrationRecordSchema>;
export type BackupCaptureAttachmentRecord = z.infer<typeof backupCaptureAttachmentRecordSchema>;
