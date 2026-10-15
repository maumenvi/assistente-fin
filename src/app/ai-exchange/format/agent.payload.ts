/** Tipos do conteudo que o app entrega ao agente (spec 029, contracts/agent.payload.format.md). */

export type AgentCell = string | number | boolean | null;

export interface AgentAccountItem {
  readonly id: string;
  readonly name: string;
  readonly kind: string;
  readonly archived: boolean;
  readonly creditLimitCents?: number | undefined;
  readonly closingDay?: number | undefined;
  readonly dueDay?: number | undefined;
}

export interface AgentCategoryItem {
  readonly id: string;
  readonly name: string;
  readonly isDefault: boolean;
}

export interface AgentLimitItem {
  readonly id: string;
  readonly v: string | null;
  readonly categoryId: string;
  readonly year: number;
  readonly month: number;
  readonly maxAmountCents: number;
}

export interface AgentFixedExpenseItem {
  readonly id: string;
  readonly v: string | null;
  readonly description: string | null;
  readonly dueDay: number;
  readonly expectedAmountCents: number;
  readonly categoryId: string;
  readonly accountId: string;
  readonly paid: boolean;
}

export interface AgentIncomeItem {
  readonly id: string;
  readonly v: string | null;
  readonly source: string;
  readonly date: string;
  readonly amountCents: number;
  readonly recurrence: string;
  readonly categoryId: string;
  readonly accountId: string | null;
}

/** Cadastros completos; so a parte 1 de uma copia os carrega. */
export interface AgentCatalog {
  readonly accounts: readonly AgentAccountItem[];
  readonly categories: readonly AgentCategoryItem[];
  readonly limits: readonly AgentLimitItem[];
  readonly fixedExpenses: readonly AgentFixedExpenseItem[];
  readonly incomes: readonly AgentIncomeItem[];
}

/** Transacoes em formato colunar (R6): `rows[i][j]` e o valor da coluna `cols[j]`. */
export interface AgentTransactionTable {
  readonly cols: readonly string[];
  readonly rows: readonly (readonly AgentCell[])[];
}

export interface AgentPayloadScope {
  readonly from: string | null;
  readonly to: string | null;
  readonly accounts: 'all' | readonly string[];
  readonly approx: boolean;
  readonly descriptionsOmitted: boolean;
}

export interface AgentPayload {
  readonly format: 'finctrl-payload';
  readonly version: number;
  readonly snapshot: { readonly id: string; readonly at: string };
  readonly part?: { readonly index: number; readonly count: number } | undefined;
  readonly scope: AgentPayloadScope;
  readonly catalog?: AgentCatalog | undefined;
  readonly transactions: AgentTransactionTable;
  /** So nos arquivos: como o agente deve me devolver dados (o compartilhamento leva um arquivo so, entao as instrucoes vao dentro). */
  readonly instructions?: string | undefined;
}

/** Colunas fixas da tabela de transacoes (ordem estavel; o agente le por `cols`). */
export const TRANSACTION_COLUMNS = [
  'id',
  'v',
  'date',
  'type',
  'amountCents',
  'notes',
  'accountId',
  'categoryId',
  'installmentGroupId',
  'installmentNumber',
  'installmentTotal',
] as const;
