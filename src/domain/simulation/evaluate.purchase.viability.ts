import { type AccountProjection, type CalendarMonth } from './account.projection.ts';
import { type PurchaseVerdict, type PurchaseVerdictLevel, type PurchaseViability } from './purchase.verdict.ts';

/** Uma compra a avaliar (a simulada ou um pre-registro). */
export interface PlannedPurchase {
  readonly amountCents: number;
  readonly accountId: string;
  readonly installments: number;
  readonly month: CalendarMonth;
}

/** Pre-registro pendente: pode nao saber conta, parcelas ou data (FR-043). */
export interface PendingPurchase {
  readonly amountCents: number;
  readonly accountId: string | null;
  readonly installments: number | null;
  readonly month: CalendarMonth | null;
}

const SEVERITY: Record<PurchaseVerdictLevel, number> = { ok: 0, 'not-recommended': 1, 'not-possible': 2 };

function monthIndex(month: CalendarMonth): number {
  return month.year * 12 + month.month - 1;
}

function classify(remaining: number, base: number, margin: number): PurchaseVerdictLevel {
  if (remaining < 0) return 'not-possible';
  if (remaining < base * margin) return 'not-recommended';
  return 'ok';
}

/** Pior entre dois vereditos: maior gravidade, depois menor sobra relativa. */
function worse(a: PurchaseVerdict, b: PurchaseVerdict): PurchaseVerdict {
  if (SEVERITY[a.level] !== SEVERITY[b.level]) return SEVERITY[a.level] > SEVERITY[b.level] ? a : b;
  const ratio = (v: PurchaseVerdict) => (v.baseCents <= 0 ? v.remainingCents : v.remainingCents / v.baseCents);
  return ratio(a) <= ratio(b) ? a : b;
}

/**
 * Pre-registro incerto (FR-043): sem conta -> conta (nao cartao) com mais saldo no mes da compra;
 * sem parcelas -> 1x; sem data -> mes da compra simulada.
 */
function resolvePending(pending: PendingPurchase, projections: readonly AccountProjection[], fallback: CalendarMonth): PlannedPurchase | null {
  const month = pending.month ?? fallback;
  let accountId = pending.accountId;
  if (accountId === null) {
    let best: { id: string; cents: number } | null = null;
    for (const projection of projections) {
      if (projection.kind !== 'account') continue;
      const cents = balanceAt(projection.monthlyBalances, month) ?? projection.baseCents;
      if (best === null || cents > best.cents) best = { id: projection.id, cents };
    }
    accountId = best?.id ?? null;
  }
  if (accountId === null) return null;
  return { amountCents: pending.amountCents, accountId, installments: pending.installments ?? 1, month };
}

function balanceAt(balances: readonly { year: number; month: number; cents: number }[], month: CalendarMonth): number | null {
  const found = balances.find((b) => b.year === month.year && b.month === month.month);
  return found?.cents ?? null;
}

/** Avalia um conjunto de compras: o pior ponto entre as contas/cartoes que elas tocam. */
function evaluate(purchases: readonly PlannedPurchase[], projections: readonly AccountProjection[], margin: number): PurchaseVerdict | null {
  let result: PurchaseVerdict | null = null;
  for (const projection of projections) {
    const mine = purchases.filter((p) => p.accountId === projection.id);
    if (mine.length === 0) continue;
    if (projection.kind === 'card') {
      // o limite do cartao e consumido pelo valor TOTAL da compra, parcelada ou nao
      const remaining = projection.availableCents - mine.reduce((sum, p) => sum + p.amountCents, 0);
      const verdict: PurchaseVerdict = {
        level: classify(remaining, projection.baseCents, margin),
        accountId: projection.id,
        month: null,
        remainingCents: remaining,
        baseCents: projection.baseCents,
      };
      result = result === null ? verdict : worse(result, verdict);
      continue;
    }
    // conta: a saida vale do mes da compra em diante (o saldo carrega de um mes para o outro)
    for (const balance of projection.monthlyBalances) {
      const spent = mine
        .filter((p) => monthIndex(p.month) <= monthIndex(balance))
        .reduce((sum, p) => sum + p.amountCents, 0);
      if (spent === 0) continue;
      const remaining = balance.cents - spent;
      const verdict: PurchaseVerdict = {
        level: classify(remaining, projection.baseCents, margin),
        accountId: projection.id,
        month: { year: balance.year, month: balance.month },
        remainingCents: remaining,
        baseCents: projection.baseCents,
      };
      result = result === null ? verdict : worse(result, verdict);
    }
  }
  return result;
}

/**
 * "Posso comprar?" (spec 022, FR-040..FR-043): "nao e possivel" se alguma conta fica negativa
 * ou algum cartao estoura o limite; "nao recomendado" se sobra menos que a margem (padrao 20%)
 * do saldo da conta ou do limite do cartao; senao "ok". Havendo pre-registros, devolve tambem o
 * resultado contando com eles.
 */
export function evaluatePurchaseViability(input: {
  readonly purchase: PlannedPurchase;
  readonly projections: readonly AccountProjection[];
  readonly pending: readonly PendingPurchase[];
  readonly safetyMargin: number;
}): PurchaseViability {
  const { purchase, projections, safetyMargin } = input;
  const alone = evaluate([purchase], projections, safetyMargin) ?? {
    level: 'ok' as const,
    accountId: purchase.accountId,
    month: null,
    remainingCents: 0,
    baseCents: 0,
  };
  if (input.pending.length === 0) return { withoutPending: alone };
  const resolved = input.pending
    .map((pending) => resolvePending(pending, projections, purchase.month))
    .filter((p): p is PlannedPurchase => p !== null);
  const together = evaluate([purchase, ...resolved], projections, safetyMargin) ?? alone;
  return { withoutPending: alone, withPending: together };
}
