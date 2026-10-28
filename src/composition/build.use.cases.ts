import { DescribePreRegistrationFateUseCase } from '../app/pre-registration/describe.pre.registration.fate.use.case.ts';
import { PurgeCaptureMemoryUseCase } from '../app/pre-registration/purge.capture.memory.use.case.ts';
import { EmitUserNotificationUseCase } from '../app/user-notification/emit.user.notification.use.case.ts';
import { ListUserNotificationsUseCase } from '../app/user-notification/list.user.notifications.use.case.ts';
import { MarkUserNotificationReadUseCase } from '../app/user-notification/mark.user.notification.read.use.case.ts';
import { ClaimUserNotificationDeliveryUseCase } from '../app/user-notification/claim.user.notification.delivery.use.case.ts';
import { NotifyMobileCapturesUseCase } from '../app/user-notification/notify.mobile.captures.use.case.ts';
import { CountUnreadUserNotificationsUseCase } from '../app/user-notification/count.unread.user.notifications.use.case.ts';
import { NoopUserNotificationDelivery } from '../app/user-notification/noop.user.notification.delivery.ts';
import { type UserNotificationDeliveryPort } from '../app/user-notification/user.notification.delivery.port.ts';
import { CreatePreRegistrationFromCaptureUseCase } from '../app/capture/create.pre.registration.from.capture.use.case.ts';
import { EvaluatePurchaseUseCase } from '../app/simulation/evaluate.purchase.use.case.ts';
import { ListPendingItemsUseCase } from '../app/pre-registration/list.pending.items.use.case.ts';
import { type PendingConflictSource } from '../app/pre-registration/pending.conflict.source.ts';
import { type DeterministicIdGenerator } from '../app/shared/deterministic.id.generator.port.ts';
import { CreatePreRegistrationUseCase } from '../app/pre-registration/create.pre.registration.use.case.ts';
import { UpdatePreRegistrationUseCase } from '../app/pre-registration/update.pre.registration.use.case.ts';
import { DiscardPreRegistrationUseCase } from '../app/pre-registration/discard.pre.registration.use.case.ts';
import { ListPreRegistrationsUseCase } from '../app/pre-registration/list.pre.registrations.use.case.ts';
import { ApprovePreRegistrationUseCase } from '../app/pre-registration/approve.pre.registration.use.case.ts';
import { MergePossibleDuplicatesUseCase } from '../app/pre-registration/merge.possible.duplicates.use.case.ts';
import { DismissPossibleDuplicateUseCase } from '../app/pre-registration/dismiss.possible.duplicate.use.case.ts';
import { type AgentWritersFactory, pickAgentWriters } from './build.agent.writers.ts';
import { type Database } from '../app/shared/database.port.ts';
import { type IdGenerator } from '../app/shared/id.generator.port.ts';
import { type Clock } from '../app/shared/clock.port.ts';
import { type VerificationCodeGenerator } from '../app/shared/verification.code.generator.port.ts';
import { type PasswordHasher } from '../app/shared/password.hasher.port.ts';
import { type RecoveryKeyGenerator } from '../app/shared/recovery.key.generator.port.ts';
import { type EmailSender } from '../app/verification/email.sender.port.ts';
import { type SmsSender } from '../app/verification/sms.sender.port.ts';
import { CreateAccountUseCase } from '../app/account/create.account.use.case.ts';
import { UpdateAccountUseCase } from '../app/account/update.account.use.case.ts';
import { ReconcileAccountBalanceUseCase } from '../app/account/reconcile.account.balance.use.case.ts';
import { DeleteAccountUseCase } from '../app/account/delete.account.use.case.ts';
import { ListAccountsUseCase } from '../app/account/list.account.use.case.ts';
import { CreateCategoryUseCase } from '../app/category/create.category.use.case.ts';
import { RenameCategoryUseCase } from '../app/category/rename.category.use.case.ts';
import { ListCategoriesUseCase } from '../app/category/list.categories.use.case.ts';
import { MigrateTransferCategoryUseCase } from '../app/category/migrate.transfer.category.use.case.ts';
import { CreateUserUseCase } from '../app/user/create.user.use.case.ts';
import { CreateFirstUserUseCase } from '../app/user/create.first.user.use.case.ts';
import { AuthenticateUserUseCase } from '../app/user/authenticate.user.use.case.ts';
import { SetUserPasswordUseCase } from '../app/user/set.user.password.use.case.ts';
import { ChangeUserPasswordUseCase } from '../app/user/change.user.password.use.case.ts';
import { RemoveUserPasswordUseCase } from '../app/user/remove.user.password.use.case.ts';
import { ResetPasswordUseCase } from '../app/user/reset.password.use.case.ts';
import { ResetPasswordWithRecoveryKeyUseCase } from '../app/user/reset.password.with.recovery.key.use.case.ts';
import { RegenerateRecoveryKeyUseCase } from '../app/user/regenerate.recovery.key.use.case.ts';
import { ClearUserCredentialsUseCase } from '../app/user/clear.user.credentials.use.case.ts';
import { SetUserDefaultAccountUseCase } from '../app/user/set.user.default.account.use.case.ts';
import { SetUserLowBalanceThresholdUseCase } from '../app/user/set.user.low.balance.threshold.use.case.ts';
import { RequestVerificationUseCase } from '../app/verification/request.verification.use.case.ts';
import { ConfirmVerificationUseCase } from '../app/verification/confirm.verification.use.case.ts';
import { LinkTelegramUseCase } from '../app/verification/link.telegram.use.case.ts';
import { RegisterIncomeUseCase } from '../app/income/register.income.use.case.ts';
import { LaunchIncomeMonthUseCase } from '../app/income/launch.income.month.use.case.ts';
import { ListIncomesUseCase } from '../app/income/list.income.use.case.ts';
import { UpdateIncomeUseCase } from '../app/income/update.income.use.case.ts';
import { DeleteIncomeUseCase } from '../app/income/delete.income.use.case.ts';
import { RegisterFixedExpenseUseCase } from '../app/fixed-expense/register.fixed.expense.use.case.ts';
import { ListFixedExpensesUseCase } from '../app/fixed-expense/list.fixed.expense.use.case.ts';
import { UpdateFixedExpenseUseCase } from '../app/fixed-expense/update.fixed.expense.use.case.ts';
import { DeleteFixedExpenseUseCase } from '../app/fixed-expense/delete.fixed.expense.use.case.ts';
import { SetFixedExpensePaidUseCase } from '../app/fixed-expense/set.fixed.expense.paid.use.case.ts';
import { SetSpendingLimitUseCase } from '../app/spending-limit/set.spending.limit.use.case.ts';
import { ListSpendingLimitsUseCase } from '../app/spending-limit/list.spending.limit.use.case.ts';
import { ListSpendingLimitsWithUsageUseCase } from '../app/spending-limit/list.spending.limits.with.usage.use.case.ts';
import { UpdateSpendingLimitUseCase } from '../app/spending-limit/update.spending.limit.use.case.ts';
import { DeleteSpendingLimitUseCase } from '../app/spending-limit/delete.spending.limit.use.case.ts';
import { RegisterSpendingLimitPlanUseCase } from '../app/spending-limit/register.spending.limit.plan.use.case.ts';
import { UpdateSpendingLimitPlanUseCase } from '../app/spending-limit/update.spending.limit.plan.use.case.ts';
import { DeleteSpendingLimitPlanUseCase } from '../app/spending-limit/delete.spending.limit.plan.use.case.ts';
import { ListSpendingLimitPlansUseCase } from '../app/spending-limit/list.spending.limit.plan.use.case.ts';
import { ApplySpendingLimitMonthUseCase } from '../app/spending-limit/apply.spending.limit.month.use.case.ts';
import { RecordTransactionUseCase } from '../app/transaction/record.transaction.use.case.ts';
import { ExtendTransactionSeriesUseCase } from '../app/transaction/extend.transaction.series.use.case.ts';
import { EndTransactionSeriesUseCase } from '../app/transaction/end.transaction.series.use.case.ts';
import { ClassifyTransactionUseCase } from '../app/transaction/classify.transaction.use.case.ts';
import { ListTransactionsUseCase } from '../app/transaction/list.transaction.use.case.ts';
import { UpdateTransactionUseCase } from '../app/transaction/update.transaction.use.case.ts';
import { DeleteTransactionUseCase } from '../app/transaction/delete.transaction.use.case.ts';
import { RecordInstallmentPurchaseUseCase } from '../app/transaction/record.installment.purchase.use.case.ts';
import { CancelRemainingInstallmentsUseCase } from '../app/transaction/cancel.remaining.installments.use.case.ts';
import { DeleteInstallmentGroupUseCase } from '../app/transaction/delete.installment.group.use.case.ts';
import { DeleteManyTransactionsUseCase } from '../app/transaction/delete.many.transactions.use.case.ts';
import { CreateTransferUseCase } from '../app/transaction/create.transfer.use.case.ts';
import { UpdateTransferUseCase } from '../app/transaction/update.transfer.use.case.ts';
import { DeleteTransferUseCase } from '../app/transaction/delete.transfer.use.case.ts';
import { CreateCardPaymentUseCase } from '../app/transaction/create.card.payment.use.case.ts';
import { UpdateCardPaymentUseCase } from '../app/transaction/update.card.payment.use.case.ts';
import { DeleteCardPaymentUseCase } from '../app/transaction/delete.card.payment.use.case.ts';
import { GetMonthlyForecastUseCase } from '../app/forecast/get.monthly.forecast.use.case.ts';
import { GetForecastRangeUseCase } from '../app/forecast/get.forecast.range.use.case.ts';
import { SimulatePurchaseUseCase } from '../app/simulation/simulate.purchase.use.case.ts';
import { ApproveSimulationUseCase } from '../app/simulation/approve.simulation.use.case.ts';
import { ExportBackupUseCase } from '../app/backup/export.backup.use.case.ts';
import { ImportBackupUseCase } from '../app/backup/import.backup.use.case.ts';
import { ExportPeriodBackupUseCase } from '../app/backup/export.period.backup.use.case.ts';
import { PlanPeriodImportUseCase } from '../app/backup/plan.period.import.use.case.ts';
import { ApplyPeriodImportUseCase } from '../app/backup/apply.period.import.use.case.ts';
import { SimulateScenarioUseCase } from '../app/scenario/simulate.scenario.use.case.ts';
import { SaveScenarioUseCase } from '../app/scenario/save.scenario.use.case.ts';
import { ListScenariosUseCase } from '../app/scenario/list.scenarios.use.case.ts';
import { GetScenarioUseCase } from '../app/scenario/get.scenario.use.case.ts';
import { UpdateScenarioUseCase } from '../app/scenario/update.scenario.use.case.ts';
import { DeleteScenarioUseCase } from '../app/scenario/delete.scenario.use.case.ts';
import { GetActiveScenarioApplicationUseCase } from '../app/scenario/get.active.scenario.application.use.case.ts';
import { ApplyScenarioUseCase } from '../app/scenario/apply.scenario.use.case.ts';
import { RevertScenarioApplicationByRecordsUseCase } from '../app/scenario/revert.scenario.application.by.records.use.case.ts';
import { RestoreDataSnapshotUseCase } from '../app/scenario/restore.data.snapshot.use.case.ts';
import { ListDataSnapshotsUseCase } from '../app/scenario/list.data.snapshots.use.case.ts';
import { ExportDataSnapshotUseCase } from '../app/scenario/export.data.snapshot.use.case.ts';
import { DeleteDataSnapshotUseCase } from '../app/scenario/delete.data.snapshot.use.case.ts';
import { CalculateCreditCardInvoiceUseCase } from '../app/credit-card/calculate.credit.card.invoice.use.case.ts';
import { EnsurePreviousMonthBalanceTransactionUseCase } from '../app/dashboard/ensure.previous.month.balance.transaction.use.case.ts';
import { CalculateCreditCardAvailableLimitUseCase } from '../app/credit-card/calculate.credit.card.available.limit.use.case.ts';
import { CalculateCreditCardCommittedBalanceUseCase } from '../app/credit-card/calculate.credit.card.committed.balance.use.case.ts';




/** Tudo que a borda (react / react-native / futura CLI) precisa pra operar (spec 001). */
export interface Container {
  readonly database: Database;
  readonly ids: IdGenerator;
  readonly clock: Clock;
  readonly codes: VerificationCodeGenerator;
  readonly passwordHasher: PasswordHasher;
  readonly recoveryKeys: RecoveryKeyGenerator;
  readonly emailSender: EmailSender;
  readonly smsSender: SmsSender;
  readonly createAccount: CreateAccountUseCase;
  readonly updateAccount: UpdateAccountUseCase;
  readonly reconcileAccountBalance: ReconcileAccountBalanceUseCase;
  readonly deleteAccount: DeleteAccountUseCase;
  readonly listAccounts: ListAccountsUseCase;
  readonly createCategory: CreateCategoryUseCase;
  readonly renameCategory: RenameCategoryUseCase;
  readonly listCategories: ListCategoriesUseCase;
  readonly migrateTransferCategory: MigrateTransferCategoryUseCase;
  readonly createUser: CreateUserUseCase;
  readonly createFirstUser: CreateFirstUserUseCase;
  readonly authenticateUser: AuthenticateUserUseCase;
  readonly setUserPassword: SetUserPasswordUseCase;
  readonly changeUserPassword: ChangeUserPasswordUseCase;
  readonly removeUserPassword: RemoveUserPasswordUseCase;
  readonly resetPassword: ResetPasswordUseCase;
  readonly resetPasswordWithRecoveryKey: ResetPasswordWithRecoveryKeyUseCase;
  readonly regenerateRecoveryKey: RegenerateRecoveryKeyUseCase;
  readonly clearUserCredentials: ClearUserCredentialsUseCase;
  readonly setUserDefaultAccount: SetUserDefaultAccountUseCase;
  readonly setUserLowBalanceThreshold: SetUserLowBalanceThresholdUseCase;
  readonly requestVerification: RequestVerificationUseCase;
  readonly confirmVerification: ConfirmVerificationUseCase;
  readonly linkTelegram: LinkTelegramUseCase;
  readonly registerIncome: RegisterIncomeUseCase;
  readonly launchIncomeMonth: LaunchIncomeMonthUseCase;
  readonly listIncomes: ListIncomesUseCase;
  readonly updateIncome: UpdateIncomeUseCase;
  readonly deleteIncome: DeleteIncomeUseCase;
  readonly registerFixedExpense: RegisterFixedExpenseUseCase;
  readonly listFixedExpenses: ListFixedExpensesUseCase;
  readonly updateFixedExpense: UpdateFixedExpenseUseCase;
  readonly deleteFixedExpense: DeleteFixedExpenseUseCase;
  readonly setFixedExpensePaid: SetFixedExpensePaidUseCase;
  readonly setSpendingLimit: SetSpendingLimitUseCase;
  readonly listSpendingLimits: ListSpendingLimitsUseCase;
  readonly listSpendingLimitsWithUsage: ListSpendingLimitsWithUsageUseCase;
  readonly updateSpendingLimit: UpdateSpendingLimitUseCase;
  readonly deleteSpendingLimit: DeleteSpendingLimitUseCase;
  readonly registerSpendingLimitPlan: RegisterSpendingLimitPlanUseCase;
  readonly updateSpendingLimitPlan: UpdateSpendingLimitPlanUseCase;
  readonly deleteSpendingLimitPlan: DeleteSpendingLimitPlanUseCase;
  readonly listSpendingLimitPlans: ListSpendingLimitPlansUseCase;
  readonly applySpendingLimitMonth: ApplySpendingLimitMonthUseCase;
  readonly recordTransaction: RecordTransactionUseCase;
  readonly classifyTransaction: ClassifyTransactionUseCase;
  readonly listTransactions: ListTransactionsUseCase;
  readonly updateTransaction: UpdateTransactionUseCase;
  readonly deleteTransaction: DeleteTransactionUseCase;
  readonly recordInstallmentPurchase: RecordInstallmentPurchaseUseCase;
  readonly cancelRemainingInstallments: CancelRemainingInstallmentsUseCase;
  readonly deleteInstallmentGroup: DeleteInstallmentGroupUseCase;
  readonly deleteManyTransactions: DeleteManyTransactionsUseCase;
  readonly createTransfer: CreateTransferUseCase;
  readonly updateTransfer: UpdateTransferUseCase;
  readonly deleteTransfer: DeleteTransferUseCase;
  readonly createCardPayment: CreateCardPaymentUseCase;
  readonly updateCardPayment: UpdateCardPaymentUseCase;
  readonly deleteCardPayment: DeleteCardPaymentUseCase;
  readonly extendTransactionSeries: ExtendTransactionSeriesUseCase;
  readonly endTransactionSeries: EndTransactionSeriesUseCase;
  readonly getMonthlyForecast: GetMonthlyForecastUseCase;
  readonly getForecastRange: GetForecastRangeUseCase;
  readonly simulatePurchase: SimulatePurchaseUseCase;
  readonly approveSimulation: ApproveSimulationUseCase;
  readonly exportBackup: ExportBackupUseCase;
  readonly importBackup: ImportBackupUseCase;
  /** Backup por periodo e importacao com conflitos (spec 022, US12) - prontos para o desktop. */
  readonly exportPeriodBackup: ExportPeriodBackupUseCase;
  readonly planImport: PlanPeriodImportUseCase;
  readonly applyImport: ApplyPeriodImportUseCase;
  readonly simulateScenario: SimulateScenarioUseCase;
  readonly saveScenario: SaveScenarioUseCase;
  readonly listScenarios: ListScenariosUseCase;
  readonly getScenario: GetScenarioUseCase;
  readonly updateScenario: UpdateScenarioUseCase;
  readonly deleteScenario: DeleteScenarioUseCase;
  readonly getActiveScenarioApplication: GetActiveScenarioApplicationUseCase;
  readonly applyScenario: ApplyScenarioUseCase;
  readonly revertScenarioApplicationByRecords: RevertScenarioApplicationByRecordsUseCase;
  readonly restoreDataSnapshot: RestoreDataSnapshotUseCase;
  readonly listDataSnapshots: ListDataSnapshotsUseCase;
  readonly exportDataSnapshot: ExportDataSnapshotUseCase;
  readonly deleteDataSnapshot: DeleteDataSnapshotUseCase;
  readonly calculateCreditCardInvoice: CalculateCreditCardInvoiceUseCase;
  readonly ensurePreviousMonthBalanceTransaction: EnsurePreviousMonthBalanceTransactionUseCase;
  readonly calculateCreditCardAvailableLimit: CalculateCreditCardAvailableLimitUseCase;
  readonly calculateCreditCardCommittedBalance: CalculateCreditCardCommittedBalanceUseCase;
  readonly createPreRegistration: CreatePreRegistrationUseCase;
  readonly updatePreRegistration: UpdatePreRegistrationUseCase;
  readonly discardPreRegistration: DiscardPreRegistrationUseCase;
  readonly listPreRegistrations: ListPreRegistrationsUseCase;
  readonly approvePreRegistration: ApprovePreRegistrationUseCase;
  /** Spec 028: "e a mesma compra" - junta pre-registros parecidos num so. */
  readonly mergePossibleDuplicates: MergePossibleDuplicatesUseCase;
  /** Spec 028: "sao compras diferentes" - o par nunca mais e agrupado nem avisado. */
  readonly dismissPossibleDuplicate: DismissPossibleDuplicateUseCase;
  readonly listPendingItems: ListPendingItemsUseCase;
  readonly evaluatePurchase: EvaluatePurchaseUseCase;
  readonly createPreRegistrationFromCapture: CreatePreRegistrationFromCaptureUseCase;
  /** Limpeza da memoria de capturas do celular (spec 027, R4). */
  readonly purgeCaptureMemory: PurgeCaptureMemoryUseCase;
  /** Destino de um pre-registro que nao esta mais pendente (spec 027, R6). */
  readonly describePreRegistrationFate: DescribePreRegistrationFateUseCase;
  /** Notificacoes do usuario (spec 013): emitir, listar, marcar lida, reivindicar toast, contar. */
  readonly emitUserNotification: EmitUserNotificationUseCase;
  readonly listUserNotifications: ListUserNotificationsUseCase;
  readonly markUserNotificationRead: MarkUserNotificationReadUseCase;
  readonly claimUserNotificationDelivery: ClaimUserNotificationDeliveryUseCase;
  readonly countUnreadUserNotifications: CountUnreadUserNotificationsUseCase;
  readonly notifyMobileCaptures: NotifyMobileCapturesUseCase;

  /** Escritores do agente sobre outro `Database`/ids (uma transacao): os mesmos casos de uso das telas (spec 033). */
  readonly agentWriters: AgentWritersFactory;

  /** Libera recursos do banco (delega a `database.close()`). */
  close(): Promise<void>;
}

/** Dependencias de infraestrutura que cada borda (desktop, celular, testes) fornece. */
export interface UseCaseDeps {
  readonly database: Database;
  readonly ids: IdGenerator;
  readonly clock: Clock;
  readonly codes: VerificationCodeGenerator;
  readonly passwordHasher: PasswordHasher;
  readonly recoveryKeys: RecoveryKeyGenerator;
  readonly emailSender: EmailSender;
  readonly smsSender: SmsSender;
  /** Ids estaveis (UUID v5) para lancamentos de aprovacao de pre-registro (spec 022). */
  readonly deterministicIds: DeterministicIdGenerator;
  /** Conflitos de sincronizacao para o sino (so no celular pareado). */
  readonly pendingConflicts?: PendingConflictSource | undefined;
  /** Como as notificacoes aparecem (spec 013, R3); ausente = so historico (`Noop`). */
  readonly userNotificationDelivery?: UserNotificationDeliveryPort | undefined;
}

/**
 * Monta todos os casos de uso sobre as dependencias recebidas (spec 022, T009). Funcao
 * portavel: nao importa banco concreto, `node:*` nem notificacao concreta - quem chama
 * (`createContainer` no desktop, `mobile.container.ts` no celular) resolve a infraestrutura.
 */
export function buildUseCases(deps: UseCaseDeps): Container {
  const { database, ids, clock, codes, passwordHasher, recoveryKeys, emailSender, smsSender, deterministicIds, pendingConflicts } = deps;

  const createAccount = new CreateAccountUseCase(database, ids);
  const updateAccount = new UpdateAccountUseCase(database, ids);
  const reconcileAccountBalance = new ReconcileAccountBalanceUseCase(database, ids);
  const deleteAccount = new DeleteAccountUseCase(database);
  const listAccounts = new ListAccountsUseCase(database.accounts);
  const createCategory = new CreateCategoryUseCase(database.categories, ids);
  const renameCategory = new RenameCategoryUseCase(database.categories);
  const listCategories = new ListCategoriesUseCase(database.categories);
  const migrateTransferCategory = new MigrateTransferCategoryUseCase(database, ids);
  const createUser = new CreateUserUseCase(database, ids, clock);
  const createFirstUser = new CreateFirstUserUseCase(
    database,
    ids,
    clock,
    passwordHasher,
    recoveryKeys,
  );
  const authenticateUser = new AuthenticateUserUseCase(database.users, passwordHasher);
  const setUserPassword = new SetUserPasswordUseCase(database.users, passwordHasher, recoveryKeys);
  const changeUserPassword = new ChangeUserPasswordUseCase(database.users, passwordHasher);
  const removeUserPassword = new RemoveUserPasswordUseCase(database.users);
  const resetPassword = new ResetPasswordUseCase(
    database.users,
    database.verificationCodes,
    passwordHasher,
    clock,
  );
  const resetPasswordWithRecoveryKey = new ResetPasswordWithRecoveryKeyUseCase(
    database.users,
    passwordHasher,
    recoveryKeys,
  );
  const clearUserCredentials = new ClearUserCredentialsUseCase(database.users);
  const setUserDefaultAccount = new SetUserDefaultAccountUseCase(database.users, database.accounts);
  const setUserLowBalanceThreshold = new SetUserLowBalanceThresholdUseCase(database.users);
  const regenerateRecoveryKey = new RegenerateRecoveryKeyUseCase(
    database.users,
    passwordHasher,
    recoveryKeys,
  );
  const requestVerification = new RequestVerificationUseCase(
    database.users,
    database.verificationCodes,
    ids,
    clock,
    codes,
    emailSender,
    smsSender,
  );
  const confirmVerification = new ConfirmVerificationUseCase(
    database.users,
    database.verificationCodes,
    clock,
  );
  const linkTelegram = new LinkTelegramUseCase(database.users, clock);
  const registerIncome = new RegisterIncomeUseCase(database, ids);
  const launchIncomeMonth = new LaunchIncomeMonthUseCase(database, ids);
  const listIncomes = new ListIncomesUseCase(
    database.incomes,
    database.categories,
    database.transactions,
    database.accounts,
  );
  const updateIncome = new UpdateIncomeUseCase(database.incomes, database.categories, ids);
  const deleteIncome = new DeleteIncomeUseCase(database.incomes);
  const registerFixedExpense = new RegisterFixedExpenseUseCase(
    database.fixedExpenses,
    database.users,
    database.accounts,
    database.categories,
    ids,
  );
  const listFixedExpenses = new ListFixedExpensesUseCase(database.fixedExpenses, database.categories);
  const updateFixedExpense = new UpdateFixedExpenseUseCase(
    database.fixedExpenses,
    database.accounts,
    database.categories,
    ids,
  );
  const deleteFixedExpense = new DeleteFixedExpenseUseCase(database);
  const setFixedExpensePaid = new SetFixedExpensePaidUseCase(database);
  const setSpendingLimit = new SetSpendingLimitUseCase(
    database.spendingLimits,
    database.users,
    database.categories,
    ids,
  );
  const listSpendingLimits = new ListSpendingLimitsUseCase(database.spendingLimits, database.categories);
  const listSpendingLimitsWithUsage = new ListSpendingLimitsWithUsageUseCase(
    database.spendingLimits,
    database.transactions,
    database.accounts,
  );
  const updateSpendingLimit = new UpdateSpendingLimitUseCase(database.spendingLimits, database.categories, ids);
  const deleteSpendingLimit = new DeleteSpendingLimitUseCase(database.spendingLimits);
  const registerSpendingLimitPlan = new RegisterSpendingLimitPlanUseCase(
    database.spendingLimitPlans,
    database.users,
    database.categories,
    ids,
  );
  const updateSpendingLimitPlan = new UpdateSpendingLimitPlanUseCase(
    database.spendingLimitPlans,
    database.categories,
    ids,
  );
  const deleteSpendingLimitPlan = new DeleteSpendingLimitPlanUseCase(database.spendingLimitPlans);
  const listSpendingLimitPlans = new ListSpendingLimitPlansUseCase(
    database.spendingLimitPlans,
    database.categories,
    database.spendingLimits,
  );
  const applySpendingLimitMonth = new ApplySpendingLimitMonthUseCase(
    database.spendingLimitPlans,
    database.spendingLimits,
    ids,
  );
  const recordTransaction = new RecordTransactionUseCase(database, ids);
  const classifyTransaction = new ClassifyTransactionUseCase(database.transactions, database.categories, ids);
  const listTransactions = new ListTransactionsUseCase(database.transactions, database.categories);
  const updateTransaction = new UpdateTransactionUseCase(database, ids);
  const deleteTransaction = new DeleteTransactionUseCase(database.transactions);
  const recordInstallmentPurchase = new RecordInstallmentPurchaseUseCase(database, ids);
  const cancelRemainingInstallments = new CancelRemainingInstallmentsUseCase(database.transactions, clock);
  const deleteInstallmentGroup = new DeleteInstallmentGroupUseCase(database.transactions);
  const deleteManyTransactions = new DeleteManyTransactionsUseCase(database.transactions);
  const createTransfer = new CreateTransferUseCase(database, ids);
  const updateTransfer = new UpdateTransferUseCase(database);
  const deleteTransfer = new DeleteTransferUseCase(database);
  const createCardPayment = new CreateCardPaymentUseCase(database, ids);
  const updateCardPayment = new UpdateCardPaymentUseCase(database);
  const deleteCardPayment = new DeleteCardPaymentUseCase(database.transactions);
  const extendTransactionSeries = new ExtendTransactionSeriesUseCase(database, ids);
  const endTransactionSeries = new EndTransactionSeriesUseCase(database, clock);
  const getMonthlyForecast = new GetMonthlyForecastUseCase(
    database.users,
    database.incomes,
    database.fixedExpenses,
    database.spendingLimits,
    database.transactions,
    database.accounts,
    database.categories,
  );
  const getForecastRange = new GetForecastRangeUseCase(
    database.users,
    database.incomes,
    database.fixedExpenses,
    database.spendingLimits,
    database.transactions,
    database.accounts,
    database.categories,
  );
  const simulatePurchase = new SimulatePurchaseUseCase(
    database.simulations,
    database.users,
    database.accounts,
    database.categories,
    ids,
    getMonthlyForecast,
  );
  const approveSimulation = new ApproveSimulationUseCase(database, ids, clock);
  const exportBackup = new ExportBackupUseCase(database, clock);
  const importBackup = new ImportBackupUseCase(database);
  const exportPeriodBackup = new ExportPeriodBackupUseCase(database, clock);
  const planImport = new PlanPeriodImportUseCase(database, clock);
  const applyImport = new ApplyPeriodImportUseCase(database, ids, clock);
  const simulateScenario = new SimulateScenarioUseCase(
    database.users,
    database.incomes,
    database.fixedExpenses,
    database.spendingLimits,
    database.transactions,
    clock,
  );
  const saveScenario = new SaveScenarioUseCase(database.scenarios, database.users, ids);
  const listScenarios = new ListScenariosUseCase(database.scenarios);
  const getScenario = new GetScenarioUseCase(database.scenarios);
  const updateScenario = new UpdateScenarioUseCase(database.scenarios);
  const deleteScenario = new DeleteScenarioUseCase(database.scenarios);
  const getActiveScenarioApplication = new GetActiveScenarioApplicationUseCase(
    database.scenarioApplications,
  );
  const applyScenario = new ApplyScenarioUseCase(database, ids, clock);
  const revertScenarioApplicationByRecords = new RevertScenarioApplicationByRecordsUseCase(database);
  const restoreDataSnapshot = new RestoreDataSnapshotUseCase(database);
  const listDataSnapshots = new ListDataSnapshotsUseCase(database.dataSnapshots);
  const exportDataSnapshot = new ExportDataSnapshotUseCase(database.dataSnapshots);
  const deleteDataSnapshot = new DeleteDataSnapshotUseCase(database.dataSnapshots);
  const calculateCreditCardInvoice = new CalculateCreditCardInvoiceUseCase(
    database.accounts,
    database.transactions,
    clock,
  );
  const calculateCreditCardAvailableLimit = new CalculateCreditCardAvailableLimitUseCase(
    database.accounts,
    database.transactions,
    clock,
  );
  const calculateCreditCardCommittedBalance = new CalculateCreditCardCommittedBalanceUseCase(
    database.accounts,
    database.transactions,
    clock,
  );
  const ensurePreviousMonthBalanceTransaction = new EnsurePreviousMonthBalanceTransactionUseCase(
    database,
    ids,
  );

  const createPreRegistration = new CreatePreRegistrationUseCase(database, ids, clock);
  const updatePreRegistration = new UpdatePreRegistrationUseCase(database);
  const discardPreRegistration = new DiscardPreRegistrationUseCase(database, clock);
  const listPreRegistrations = new ListPreRegistrationsUseCase(database.preRegistrations);
  const approvePreRegistration = new ApprovePreRegistrationUseCase(database, deterministicIds, clock);
  const mergePossibleDuplicates = new MergePossibleDuplicatesUseCase(database, clock);
  const dismissPossibleDuplicate = new DismissPossibleDuplicateUseCase(database);
  const listPendingItems = new ListPendingItemsUseCase(database.preRegistrations, pendingConflicts);
  const evaluatePurchase = new EvaluatePurchaseUseCase(database, clock, calculateCreditCardAvailableLimit);
  const purgeCaptureMemory = new PurgeCaptureMemoryUseCase(database, clock);
  const describePreRegistrationFate = new DescribePreRegistrationFateUseCase(database);
  const userNotificationDelivery = deps.userNotificationDelivery ?? new NoopUserNotificationDelivery();
  const emitUserNotification = new EmitUserNotificationUseCase(database, ids, clock, userNotificationDelivery);
  const listUserNotifications = new ListUserNotificationsUseCase(database);
  const markUserNotificationRead = new MarkUserNotificationReadUseCase(database, clock);
  const claimUserNotificationDelivery = new ClaimUserNotificationDeliveryUseCase(database, clock);
  const countUnreadUserNotifications = new CountUnreadUserNotificationsUseCase(database);
  const notifyMobileCaptures = new NotifyMobileCapturesUseCase(emitUserNotification);
  const createPreRegistrationFromCapture = new CreatePreRegistrationFromCaptureUseCase(database, ids, clock);

  return {
    database,
    ids,
    clock,
    codes,
    passwordHasher,
    recoveryKeys,
    emailSender,
    smsSender,
    createAccount,
    updateAccount,
    reconcileAccountBalance,
    deleteAccount,
    listAccounts,
    createCategory,
    renameCategory,
    listCategories,
    migrateTransferCategory,
    createUser,
    createFirstUser,
    authenticateUser,
    setUserPassword,
    changeUserPassword,
    removeUserPassword,
    resetPassword,
    resetPasswordWithRecoveryKey,
    regenerateRecoveryKey,
    clearUserCredentials,
    setUserDefaultAccount,
    setUserLowBalanceThreshold,
    requestVerification,
    confirmVerification,
    linkTelegram,
    registerIncome,
    launchIncomeMonth,
    listIncomes,
    updateIncome,
    deleteIncome,
    registerFixedExpense,
    listFixedExpenses,
    updateFixedExpense,
    deleteFixedExpense,
    setFixedExpensePaid,
    setSpendingLimit,
    listSpendingLimits,
    listSpendingLimitsWithUsage,
    updateSpendingLimit,
    deleteSpendingLimit,
    registerSpendingLimitPlan,
    updateSpendingLimitPlan,
    deleteSpendingLimitPlan,
    listSpendingLimitPlans,
    applySpendingLimitMonth,
    recordTransaction,
    extendTransactionSeries,
    endTransactionSeries,
    classifyTransaction,
    listTransactions,
    updateTransaction,
    deleteTransaction,
    recordInstallmentPurchase,
    cancelRemainingInstallments,
    deleteInstallmentGroup,
    deleteManyTransactions,
    createTransfer,
    updateTransfer,
    deleteTransfer,
    createCardPayment,
    updateCardPayment,
    deleteCardPayment,
    getMonthlyForecast,
    getForecastRange,
    simulatePurchase,
    approveSimulation,
    exportBackup,
    importBackup,
    exportPeriodBackup,
    planImport,
    applyImport,
    simulateScenario,
    saveScenario,
    listScenarios,
    getScenario,
    updateScenario,
    deleteScenario,
    getActiveScenarioApplication,
    applyScenario,
    revertScenarioApplicationByRecords,
    restoreDataSnapshot,
    listDataSnapshots,
    exportDataSnapshot,
    deleteDataSnapshot,
    calculateCreditCardInvoice,
    calculateCreditCardAvailableLimit,
    calculateCreditCardCommittedBalance,
    createPreRegistration,
    updatePreRegistration,
    discardPreRegistration,
    listPreRegistrations,
    approvePreRegistration,
    mergePossibleDuplicates,
    dismissPossibleDuplicate,
    listPendingItems,
    evaluatePurchase,
    createPreRegistrationFromCapture,
    purgeCaptureMemory,
    describePreRegistrationFate,
    emitUserNotification,
    listUserNotifications,
    markUserNotificationRead,
    claimUserNotificationDelivery,
    countUnreadUserNotifications,
    notifyMobileCaptures,
    ensurePreviousMonthBalanceTransaction,
    agentWriters: (scopedDatabase, scopedIds) => pickAgentWriters(buildUseCases({ ...deps, database: scopedDatabase, ids: scopedIds })),
    close: () => database.close(),
  };
}
