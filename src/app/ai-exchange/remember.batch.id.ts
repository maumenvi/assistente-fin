import { MAX_REMEMBERED_BATCH_IDS, type AiExchangePreferences } from './ai.exchange.preferences.ts';

/** Lembra um lote importado ou dispensado para o app nao oferece-lo de novo (spec 029, FR-016, R9). */
export function rememberBatchId(preferences: AiExchangePreferences, batchId: string): AiExchangePreferences {
  const others = preferences.dismissedBatchIds.filter((id) => id !== batchId);
  return { ...preferences, dismissedBatchIds: [...others, batchId].slice(-MAX_REMEMBERED_BATCH_IDS) };
}

/** O lote ja foi importado ou dispensado? */
export function isBatchRemembered(preferences: AiExchangePreferences, batchId: string): boolean {
  return preferences.dismissedBatchIds.includes(batchId);
}
