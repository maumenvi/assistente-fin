import { type Database } from '../app/shared/database.port.ts';
import { type IdGenerator } from '../app/shared/id.generator.port.ts';
import { type Container } from './build.use.cases.ts';

/**
 * Os 14 casos de uso de escrita que um plano pode aplicar (spec 033, FR-004): os mesmos das telas,
 * nunca um caminho paralelo. Em Pick do `Container` para o app so depender do que usa.
 */
export type AgentWriters = Pick<
  Container,
  | 'recordTransaction'
  | 'updateTransaction'
  | 'classifyTransaction'
  | 'deleteTransaction'
  | 'createCategory'
  | 'renameCategory'
  | 'registerIncome'
  | 'updateIncome'
  | 'deleteIncome'
  | 'registerFixedExpense'
  | 'updateFixedExpense'
  | 'deleteFixedExpense'
  | 'createTransfer'
  | 'createCardPayment'
>;

/** Monta os escritores sobre um `Database` (normalmente o `tx` de uma transacao) e um gerador de ids (mesmo padrao da spec 029). */
export type AgentWritersFactory = (database: Database, ids: IdGenerator) => AgentWriters;

/** Escolhe do `Container` so os escritores do agente. */
export function pickAgentWriters(c: Container): AgentWriters {
  return {
    recordTransaction: c.recordTransaction,
    updateTransaction: c.updateTransaction,
    classifyTransaction: c.classifyTransaction,
    deleteTransaction: c.deleteTransaction,
    createCategory: c.createCategory,
    renameCategory: c.renameCategory,
    registerIncome: c.registerIncome,
    updateIncome: c.updateIncome,
    deleteIncome: c.deleteIncome,
    registerFixedExpense: c.registerFixedExpense,
    updateFixedExpense: c.updateFixedExpense,
    deleteFixedExpense: c.deleteFixedExpense,
    createTransfer: c.createTransfer,
    createCardPayment: c.createCardPayment,
  };
}
