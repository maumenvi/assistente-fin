/**
 * Entidades sincronizadas entre celular e hub (spec 022, data-model.md): exatamente os tipos que
 * tem record no backup, na ordem em que podem ser gravados (pais antes dos filhos). O nome e o
 * mesmo `kind` do record do backup.
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
] as const;

/** Uma das entidades sincronizadas. */
export type SyncEntity = (typeof SYNC_ENTITIES)[number];
