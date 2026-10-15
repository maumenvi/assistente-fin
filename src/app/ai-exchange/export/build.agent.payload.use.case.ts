import { z } from 'zod';
import { type Database } from '../../shared/database.port.ts';
import { type Clock } from '../../shared/clock.port.ts';
import { type IdGenerator } from '../../shared/id.generator.port.ts';
import { InvalidInputError } from '../../shared/invalid.input.error.ts';
import { AGENT_FORMAT_VERSION } from '../format/format.version.ts';
import { type AgentPayload, TRANSACTION_COLUMNS } from '../format/agent.payload.ts';
import { agentExportOptionsSchema } from './agent.export.options.ts';
import { applyPrivacyOptions } from './apply.privacy.options.ts';
import { toAgentAccount } from './dto/to.agent.account.ts';
import { toAgentCategory } from './dto/to.agent.category.ts';
import { toAgentFixedExpense } from './dto/to.agent.fixed.expense.ts';
import { toAgentIncome } from './dto/to.agent.income.ts';
import { toAgentLimit } from './dto/to.agent.limit.ts';
import { toAgentTransactionRow } from './dto/agent.transaction.row.ts';
import { toIsoDay } from './dto/iso.date.ts';

const inputSchema = z.object({
  userId: z.string().trim().min(1, 'userId obrigatorio'),
  options: agentExportOptionsSchema.prefault({}),
});

const DAY_MS = 86_400_000;

/**
 * Monta o conteudo completo que o app entrega ao agente (spec 029, FR-001, contracts/
 * agent.payload.format.md): cadastros inteiros e todas as transacoes do periodo, em formato
 * colunar, mais recentes primeiro, ja com as opcoes de privacidade. Cada chamada gera uma copia
 * nova (`snapshot.id` + `at`). A particao em partes e o orcamento da area de transferencia sao de
 * `splitPayloadParts`; o arquivo "completo" usa este conteudo inteiro.
 */
export class BuildAgentPayloadUseCase {
  private readonly database: Database;
  private readonly ids: IdGenerator;
  private readonly clock: Clock;

  public constructor(database: Database, ids: IdGenerator, clock: Clock) {
    this.database = database;
    this.ids = ids;
    this.clock = clock;
  }

  public async execute(rawInput: unknown): Promise<AgentPayload> {
    const parsed = inputSchema.safeParse(rawInput);
    if (!parsed.success) {
      const flat = z.flattenError(parsed.error);
      throw new InvalidInputError('montar conteudo para a IA', flat.fieldErrors, flat.formErrors);
    }
    const { userId, options } = parsed.data;
    const now = this.clock.now();
    // dias inteiros: o periodo comeca na meia-noite (UTC) de `periodDays` dias atras
    const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    const from = options.periodDays === null ? null : new Date(today - options.periodDays * DAY_MS);

    const [accounts, categories, limits, fixedExpenses, incomes, transactions] = await Promise.all([
      this.database.accounts.listByUser(userId),
      this.database.categories.listByUser(userId),
      this.database.spendingLimits.listByUser(userId),
      this.database.fixedExpenses.listByUser(userId),
      this.database.incomes.listByUser(userId),
      this.database.transactions.listByUser(userId),
    ]);

    const rows = transactions
      .filter((transaction) => from === null || transaction.date.getTime() >= from.getTime())
      .sort((a, b) => b.date.getTime() - a.date.getTime() || a.id.localeCompare(b.id))
      .map(toAgentTransactionRow);

    const payload: AgentPayload = {
      format: 'finctrl-payload',
      version: AGENT_FORMAT_VERSION,
      snapshot: { id: this.ids.next(), at: now.toISOString() },
      scope: {
        from: from === null ? null : toIsoDay(from),
        to: toIsoDay(now),
        accounts: 'all',
        approx: false,
        descriptionsOmitted: false,
      },
      catalog: {
        accounts: accounts.map(toAgentAccount),
        categories: categories.map(toAgentCategory),
        limits: limits.map(toAgentLimit),
        fixedExpenses: fixedExpenses.map(toAgentFixedExpense),
        incomes: incomes.map(toAgentIncome),
      },
      transactions: { cols: [...TRANSACTION_COLUMNS], rows },
    };
    return applyPrivacyOptions(payload, options);
  }
}
