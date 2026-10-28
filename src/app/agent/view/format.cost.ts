import { microToUsdString } from '../../../domain/agent/micro.to.usd.string.ts';

/** Custo estimado; `null` = o provedor nao informou. */
export function formatCost(micro: number | null): string {
  return micro === null ? 'indisponível' : microToUsdString(micro);
}
