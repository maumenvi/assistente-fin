import { type PreRegistrationRepository } from '../../app/pre-registration/pre.registration.repository.port.ts';
import { type CaptureAttachmentRepository } from '../../app/pre-registration/capture.attachment.repository.port.ts';
import { FakeCaptureReceiptRepository } from './capture.receipt.repository.fake.ts';
import { FakePreRegistrationOutcomeRepository } from './pre.registration.outcome.repository.fake.ts';
import { type CaptureReceiptRepository } from '../../app/pre-registration/capture.receipt.repository.port.ts';
import { type PreRegistrationOutcomeRepository } from '../../app/pre-registration/pre.registration.outcome.repository.port.ts';
import { FakeUserNotificationRepository } from './user.notification.repository.fake.ts';
import { type UserNotificationRepository } from '../../app/user-notification/user.notification.repository.port.ts';
import { FakePreRegistrationRepository } from './pre.registration.repository.fake.ts';
import { FakeCaptureAttachmentRepository } from './capture.attachment.repository.fake.ts';
import { type Database } from '../../app/shared/database.port.ts';
import { type AccountRepository } from '../../app/account/account.repository.port.ts';
import { type UserRepository } from '../../app/user/user.repository.port.ts';
import { type VerificationCodeRepository } from '../../app/verification/verification.code.repository.port.ts';
import { type IncomeRepository } from '../../app/income/income.repository.port.ts';
import { type FixedExpenseRepository } from '../../app/fixed-expense/fixed.expense.repository.port.ts';
import { type SpendingLimitRepository } from '../../app/spending-limit/spending.limit.repository.port.ts';
import { type SpendingLimitPlanRepository } from '../../app/spending-limit/spending.limit.plan.repository.port.ts';
import { type TransactionRepository } from '../../app/transaction/transaction.repository.port.ts';
import { type SimulationRepository } from '../../app/simulation/simulation.repository.port.ts';
import { type ScenarioRepository } from '../../app/scenario/scenario.repository.port.ts';
import { type ScenarioApplicationRepository } from '../../app/scenario/scenario.application.repository.port.ts';
import { type DataSnapshotRepository } from '../../app/scenario/data.snapshot.repository.port.ts';
import { type CategoryRepository } from '../../app/category/category.repository.port.ts';
import { type TransactionSeriesRepository } from '../../app/transaction/transaction.series.repository.port.ts';
import { type AccessKeyRepositoryPort } from '../../app/shared/access.key.repository.port.ts';
import { FakeAccountRepository } from './account.repository.fake.ts';
import { FakeUserRepository } from './user.repository.fake.ts';
import { FakeVerificationCodeRepository } from './verification.code.repository.fake.ts';
import { FakeIncomeRepository } from './income.repository.fake.ts';
import { FakeFixedExpenseRepository } from './fixed.expense.repository.fake.ts';
import { FakeSpendingLimitRepository } from './spending.limit.repository.fake.ts';
import { FakeSpendingLimitPlanRepository } from './spending.limit.plan.repository.fake.ts';
import { FakeTransactionRepository } from './transaction.repository.fake.ts';
import { FakeSimulationRepository } from './simulation.repository.fake.ts';
import { FakeScenarioRepository } from './scenario.repository.fake.ts';
import { FakeScenarioApplicationRepository } from './scenario.application.repository.fake.ts';
import { FakeDataSnapshotRepository } from './data.snapshot.repository.fake.ts';
import { FakeCategoryRepository } from './category.repository.fake.ts';
import { FakeTransactionSeriesRepository } from './transaction.series.repository.fake.ts';
import { AccessKeyRepositoryFake } from './access.key.repository.fake.ts';
import { type BalanceGenerationRepository } from '../../app/dashboard/balance.generation.repository.port.ts';
import { FakeBalanceGenerationRepository } from './balance.generation.repository.fake.ts';

/**
 * `Database` falso (test double), composto por repositorios `fake` (spec 001, RF-20).
 *
 * Uso em desenvolvimento offline e nos testes: nenhuma rede, nenhum Postgres. `transaction`
 * so chama `work` direto - nao ha isolamento real de transacao, o que basta porque o estado
 * ja vive num unico processo. `close` e no-op (nao ha conexao para liberar).
 */
export class FakeDatabase implements Database {
  public readonly accounts: AccountRepository;
  public readonly users: UserRepository;
  public readonly verificationCodes: VerificationCodeRepository;
  public readonly incomes: IncomeRepository;
  public readonly fixedExpenses: FixedExpenseRepository;
  public readonly spendingLimits: SpendingLimitRepository;
  public readonly spendingLimitPlans: SpendingLimitPlanRepository;
  public readonly transactions: TransactionRepository;
  public readonly transactionSeries: TransactionSeriesRepository;
  public readonly simulations: SimulationRepository;
  public readonly scenarios: ScenarioRepository;
  public readonly scenarioApplications: ScenarioApplicationRepository;
  public readonly dataSnapshots: DataSnapshotRepository;
  public readonly categories: CategoryRepository;
  public readonly mcpAccessKeys: AccessKeyRepositoryPort;
  public readonly balanceGenerations: BalanceGenerationRepository;
  public readonly preRegistrations: PreRegistrationRepository;
  public readonly captureAttachments: CaptureAttachmentRepository;
  public readonly userNotifications: UserNotificationRepository;
  public readonly captureReceipts: CaptureReceiptRepository;
  public readonly preRegistrationOutcomes: PreRegistrationOutcomeRepository;

  public constructor() {
    this.accounts = new FakeAccountRepository();
    this.users = new FakeUserRepository();
    this.verificationCodes = new FakeVerificationCodeRepository();
    this.incomes = new FakeIncomeRepository();
    this.fixedExpenses = new FakeFixedExpenseRepository();
    this.spendingLimits = new FakeSpendingLimitRepository();
    this.spendingLimitPlans = new FakeSpendingLimitPlanRepository();
    this.transactions = new FakeTransactionRepository();
    this.transactionSeries = new FakeTransactionSeriesRepository();
    this.simulations = new FakeSimulationRepository();
    this.scenarios = new FakeScenarioRepository();
    this.scenarioApplications = new FakeScenarioApplicationRepository();
    this.dataSnapshots = new FakeDataSnapshotRepository();
    this.categories = new FakeCategoryRepository();
    this.mcpAccessKeys = new AccessKeyRepositoryFake();
    this.balanceGenerations = new FakeBalanceGenerationRepository();
    this.preRegistrations = new FakePreRegistrationRepository();
    this.captureAttachments = new FakeCaptureAttachmentRepository();
    this.userNotifications = new FakeUserNotificationRepository();
    this.captureReceipts = new FakeCaptureReceiptRepository();
    this.preRegistrationOutcomes = new FakePreRegistrationOutcomeRepository();
  }

  public async transaction<T>(work: (tx: Database) => Promise<T>): Promise<T> {
    return work(this);
  }

  public async checkConnection(): Promise<void> {
    // sempre acessivel: o estado vive no proprio processo
  }

  public async close(): Promise<void> {
    // sem conexao a liberar
  }
}
