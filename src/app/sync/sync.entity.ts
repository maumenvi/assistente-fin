/**
 * Entidades sincronizadas entre celular e hub (spec 022, data-model.md): exatamente os tipos que
 * tem record no backup, na ordem em que podem ser gravados (pais antes dos filhos). O nome e o
 * mesmo `kind` do record do backup. `preference` (spec 032) e `categorizationRule` (spec 033) entram no fim: dependem de contas e categorias.
 */
export const SYNC_ENTITIES = [
  'category',
  'account',
  'income',
  'fixedExpense',
  'spendingLimitPlan',
  'spendingLimit',
  'transactionSeries',
  'transaction',
  'purchaseSimulation',
  'preRegistration',
  'captureAttachment',
  'preference',
  'categorizationRule',
] as const;

/** Uma das entidades sincronizadas. */
export type SyncEntity = (typeof SYNC_ENTITIES)[number];
