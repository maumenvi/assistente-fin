import { type Preference } from '../preference.ts';
import { orderStable } from './order.stable.ts';

/** Teto padrao do bloco de preferencias, em tokens estimados (spec 032, plano). */
export const PREFERENCE_BUDGET_TOKENS = 600;

/**
 * Corta ate caber no orcamento: sai primeiro quem tem menor confianca e, no empate, uso mais
 * antigo; as que ficam mantem a ordem estavel. `estimate` e injetado (o dominio nao conhece o
 * estimador da camada de app).
 */
export function fitBudget(prefs: readonly Preference[], maxTokens: number, estimate: (text: string) => number): Preference[] {
  const ranked = [...prefs].sort((a, b) => b.confidence - a.confidence || (b.lastUsedAt ?? '').localeCompare(a.lastUsedAt ?? ''));
  const kept: Preference[] = [];
  let used = 0;
  for (const p of ranked) {
    const cost = estimate(p.text) + 2;
    if (used + cost > maxTokens) continue;
    used += cost;
    kept.push(p);
  }
  return orderStable(kept);
}
