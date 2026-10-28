import { type CapabilityStoresPort } from '../agent/capability/ports/capability.stores.port.ts';
import { type PlanStoresPort } from '../agent/plan/ports/plan.stores.port.ts';
import { type PreferenceStoresPort } from '../agent/ports/preference/preference.stores.port.ts';
import { type AgentStorePort } from '../agent/ports/store/agent.store.port.ts';
import { type PreRegistrationRepository } from '../pre-registration/pre.registration.repository.port.ts';
import { type CaptureAttachmentRepository } from '../pre-registration/capture.attachment.repository.port.ts';
import { type AccountRepository } from '../account/account.repository.port.ts';
import { type UserRepository } from '../user/user.repository.port.ts';
import { type VerificationCodeRepository } from '../verification/verification.code.repository.port.ts';
import { type IncomeRepository } from '../income/income.repository.port.ts';
import { type FixedExpenseRepository } from '../fixed-expense/fixed.expense.repository.port.ts';
import { type SpendingLimitRepository } from '../spending-limit/spending.limit.repository.port.ts';
import { type SpendingLimitPlanRepository } from '../spending-limit/spending.limit.plan.repository.port.ts';
import { type TransactionRepository } from '../transaction/transaction.repository.port.ts';
import { type SimulationRepository } from '../simulation/simulation.repository.port.ts';
import { type ScenarioRepository } from '../scenario/scenario.repository.port.ts';
import { type ScenarioApplicationRepository } from '../scenario/scenario.application.repository.port.ts';
import { type DataSnapshotRepository } from '../scenario/data.snapshot.repository.port.ts';
import { type CategoryRepository } from '../category/category.repository.port.ts';
import { type TransactionSeriesRepository } from '../transaction/transaction.series.repository.port.ts';
import { type AccessKeyRepositoryPort } from './access.key.repository.port.ts';
import { type BalanceGenerationRepository } from '../dashboard/balance.generation.repository.port.ts';
import { type CaptureReceiptRepository } from '../pre-registration/capture.receipt.repository.port.ts';
import { type PreRegistrationOutcomeRepository } from '../pre-registration/pre.registration.outcome.repository.port.ts';
import { type UserNotificationRepository } from '../user-notification/user.notification.repository.port.ts';

/**
 * Porta de persistencia generica (spec 001, RF-20, RF-21).
 *
 * O dominio e os casos de uso dependem so desta interface, nunca de um banco concreto.
 * Quem injeta a implementacao (`FakeDatabase`, `PrismaDatabase`, ...) e a raiz de DI
 * (`composition/container.ts`), escolhida por `database/database.factory.ts` a partir da
 * config (RF-21). Trocar ou adicionar banco toca so os adaptadores de `database/` - nunca
 * esta porta nem quem a consome (CA-19).
 *
 * Cresce um acessor por contexto de dominio a medida que novas fases entregam repositorios.
 */
export interface Database {
  /** Repositorio de contas (RF-1). */
  readonly accounts: AccountRepository;

  /** Repositorio de usuarios (RF-15, RF-16). */
  readonly users: UserRepository;

  /** Repositorio de codigos de verificacao (RF-24..RF-27). */
  readonly verificationCodes: VerificationCodeRepository;

  /** Repositorio de ganhos (RF-2). */
  readonly incomes: IncomeRepository;

  /** Repositorio de gastos fixos (RF-3). */
  readonly fixedExpenses: FixedExpenseRepository;

  /** Repositorio de limites de gasto (RF-4). */
  readonly spendingLimits: SpendingLimitRepository;

  /** Repositorio de planos (definicoes recorrentes) de limite de gasto (spec 016). */
  readonly spendingLimitPlans: SpendingLimitPlanRepository;

  /** Repositorio de transacoes (RF-5, RF-6). */
  readonly transactions: TransactionRepository;

  /** Repositorio de series de transacoes recorrentes (spec 003, RF-25). */
  readonly transactionSeries: TransactionSeriesRepository;

  /** Repositorio de simulacoes de compra (RF-9..RF-11). */
  readonly simulations: SimulationRepository;

  /** Repositorio de cenarios de projecao (spec 002, RF-34..RF-36). */
  readonly scenarios: ScenarioRepository;

  /** Repositorio de aplicacoes de cenario / "recibos" (spec 002, RF-37, RF-38, RF-40). */
  readonly scenarioApplications: ScenarioApplicationRepository;

  /** Repositorio de snapshots / pontos de restauracao (spec 002, RF-37, RF-40a). */
  readonly dataSnapshots: DataSnapshotRepository;

  /** Repositorio de categorias (spec 003, RF-6..RF-8). */
  readonly categories: CategoryRepository;

  /** Repositorio da chave de acesso do servidor MCP local (spec 004, RF-13). */
  readonly mcpAccessKeys: AccessKeyRepositoryPort;

  /** Controle de geracao do lancamento automatico de saldo do mes anterior (spec 011, RF-16). */
  readonly balanceGenerations: BalanceGenerationRepository;

  /** Pre-registros de compra, separados dos lancamentos (spec 022, FR-021). */
  readonly preRegistrations: PreRegistrationRepository;

  /** Anexos das capturas (foto, texto da notificacao/fala/OCR) (spec 022). */
  readonly captureAttachments: CaptureAttachmentRepository;

  /** Notificacoes do usuario (spec 013, RF-6). */
  readonly userNotifications: UserNotificationRepository;

  /** Recibos de captura da carteira, locais do celular (spec 027, R2). */
  readonly captureReceipts: CaptureReceiptRepository;

  /** Destino de pre-registros removidos (spec 027, R6). */
  readonly preRegistrationOutcomes: PreRegistrationOutcomeRepository;

  /** Conversas, mensagens, execucoes e passos do agente de IA; locais do aparelho (spec 031). */
  readonly agent: AgentStorePort;

  /** Preferencias do usuario, sinais de aprendizado e recusas (spec 032); so `preferences` sincroniza. */
  readonly preferences: PreferenceStoresPort;

  /** Planos, politica de autonomia, regras de categorizacao e evidencias (spec 033); so `rules` sincroniza. */
  readonly plans: PlanStoresPort;

  /** Capacidades dinamicas do agente (spec 034): locais ao aparelho e ao usuario, sem sync nem backup. */
  readonly capabilities: CapabilityStoresPort;

  /**
   * Executa `work` como unidade de trabalho: no adaptador `fake` roda direto, no `prisma`
   * roda dentro de uma transacao (`$transaction`). Casos de uso que tocam mais de um
   * repositorio devem passar pelo `tx` recebido, nunca por `this`.
   */
  transaction<T>(work: (tx: Database) => Promise<T>): Promise<T>;

  /**
   * Verifica se o armazenamento esta acessivel (spec 002, RF-1, CA-2): resolve quando da
   * para conversar com o banco, rejeita (com o erro do driver) quando nao da. Nao depende do
   * schema estar migrado - e so um "alo". A borda desktop usa isto no "Testar conexao".
   */
  checkConnection(): Promise<void>;

  /** Libera recursos do adaptador (ex.: pool de conexoes). No-op quando nao se aplica. */
  close(): Promise<void>;
}
