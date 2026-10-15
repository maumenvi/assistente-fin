import { type AgentCatalog, type AgentCell, type AgentPayload, TRANSACTION_COLUMNS } from '../format/agent.payload.ts';
import { type AgentExportOptions } from './agent.export.options.ts';

/** Texto no lugar de uma descricao omitida: o agente sabe que existia, mas nao ve o conteudo. */
const OMITTED_TEXT = 'omitido';

/** Arredonda centavos para reais inteiros (spec 029, R7). */
function roundToReais(cents: number): number {
  return Math.round(cents / 100) * 100;
}

const COLUMN_INDEX = Object.fromEntries(TRANSACTION_COLUMNS.map((name, index) => [name, index])) as Record<
  (typeof TRANSACTION_COLUMNS)[number],
  number
>;

function privatizeRow(row: readonly AgentCell[], options: AgentExportOptions): readonly AgentCell[] {
  const next = [...row];
  if (options.omitDescriptions) next[COLUMN_INDEX.notes] = null;
  if (options.roundValues) {
    const cents = next[COLUMN_INDEX.amountCents];
    if (typeof cents === 'number') next[COLUMN_INDEX.amountCents] = roundToReais(cents);
  }
  return next;
}

function privatizeCatalog(catalog: AgentCatalog, options: AgentExportOptions): AgentCatalog {
  const excludedAccounts = new Set(options.excludedAccountIds);
  const excludedCategories = new Set(options.excludedCategoryIds);
  const round = (cents: number): number => (options.roundValues ? roundToReais(cents) : cents);
  return {
    accounts: catalog.accounts.filter((account) => !excludedAccounts.has(account.id)),
    categories: catalog.categories.filter((category) => !excludedCategories.has(category.id)),
    limits: catalog.limits
      .filter((limit) => !excludedCategories.has(limit.categoryId))
      .map((limit) => ({ ...limit, maxAmountCents: round(limit.maxAmountCents) })),
    fixedExpenses: catalog.fixedExpenses
      .filter((item) => !excludedAccounts.has(item.accountId) && !excludedCategories.has(item.categoryId))
      .map((item) => ({
        ...item,
        description: options.omitDescriptions ? null : item.description,
        expectedAmountCents: round(item.expectedAmountCents),
      })),
    incomes: catalog.incomes
      .filter(
        (item) =>
          (item.accountId === null || !excludedAccounts.has(item.accountId)) && !excludedCategories.has(item.categoryId),
      )
      .map((item) => ({
        ...item,
        source: options.omitDescriptions ? OMITTED_TEXT : item.source,
        amountCents: round(item.amountCents),
      })),
  };
}

/**
 * Aplica as opcoes de privacidade ao conteudo (spec 029, FR-012, R7): tira contas e categorias
 * excluidas (e tudo que as usa), omite descricoes e arredonda valores. Roda antes de contar o
 * orcamento da copia. O filtro de periodo e feito ao ler as transacoes (`BuildAgentPayloadUseCase`).
 */
export function applyPrivacyOptions(payload: AgentPayload, options: AgentExportOptions): AgentPayload {
  const excludedAccounts = new Set(options.excludedAccountIds);
  const excludedCategories = new Set(options.excludedCategoryIds);
  const rows = payload.transactions.rows
    .filter((row) => !excludedAccounts.has(String(row[COLUMN_INDEX.accountId])) && !excludedCategories.has(String(row[COLUMN_INDEX.categoryId])))
    .map((row) => privatizeRow(row, options));
  return {
    ...payload,
    scope: {
      ...payload.scope,
      accounts: options.excludedAccountIds.length === 0 ? 'all' : payload.scope.accounts,
      approx: options.roundValues,
      descriptionsOmitted: options.omitDescriptions,
    },
    ...(payload.catalog === undefined ? {} : { catalog: privatizeCatalog(payload.catalog, options) }),
    transactions: { cols: payload.transactions.cols, rows },
  };
}
