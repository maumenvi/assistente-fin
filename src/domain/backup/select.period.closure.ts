import { type PortableRecord } from './portable.record.ts';
import { isInRange, monthTouchesRange, type DateRange } from './date.range.ts';

/** Campos que agrupam lancamentos que so fazem sentido juntos. */
const GROUP_FIELDS = ['installmentGroupId', 'seriesId', 'transferGroupId', 'cardPaymentGroupId'] as const;
/** Campos que apontam para contas/categorias. */
const PARENT_FIELDS = ['accountId', 'categoryId'] as const;

function text(record: PortableRecord, field: string): string | undefined {
  const value = record[field];
  return typeof value === 'string' && value !== '' ? value : undefined;
}

/**
 * Fecho referencial de um backup por periodo (spec 022, T141; contracts/period-backup.md):
 *
 * 1. lancamentos com data no periodo;
 * 2. TODOS os membros dos grupos tocados (parcelas, serie, transferencia, pagamento de fatura),
 *    mesmo fora do periodo, e a propria serie;
 * 3. ganhos e gastos fixos referenciados; limites cujo mes toca o periodo, com o plano;
 * 4. pre-registros do periodo (data ou, sem data, criacao), com os anexos;
 * 5. contas e categorias referenciadas por qualquer item acima.
 *
 * Devolve os records na ordem de entrada (a do backup completo ja poe pais antes de filhos).
 */
export function selectPeriodClosure(records: readonly PortableRecord[], range: DateRange): PortableRecord[] {
  const byKind = (kind: string) => records.filter((record) => record.kind === kind);
  const selected = new Set<PortableRecord>();

  const transactions = byKind('transaction');
  const inPeriod = transactions.filter((t) => isInRange(t['date'], range));
  const groups = new Map<string, Set<string>>(GROUP_FIELDS.map((field) => [field, new Set<string>()]));
  for (const t of inPeriod) {
    for (const field of GROUP_FIELDS) {
      const id = text(t, field);
      if (id !== undefined) groups.get(field)!.add(id);
    }
  }
  for (const t of transactions) {
    const inGroup = GROUP_FIELDS.some((field) => {
      const id = text(t, field);
      return id !== undefined && groups.get(field)!.has(id);
    });
    if (inGroup || inPeriod.includes(t)) selected.add(t);
  }
  const seriesIds = groups.get('seriesId')!;
  for (const s of byKind('transactionSeries')) if (s.id !== undefined && seriesIds.has(s.id)) selected.add(s);

  const incomeIds = new Set([...selected].map((t) => text(t, 'incomeId')).filter((id): id is string => id !== undefined));
  const fixedIds = new Set([...selected].map((t) => text(t, 'fixedExpenseId')).filter((id): id is string => id !== undefined));
  for (const i of byKind('income')) if (i.id !== undefined && incomeIds.has(i.id)) selected.add(i);
  for (const f of byKind('fixedExpense')) if (f.id !== undefined && fixedIds.has(f.id)) selected.add(f);

  const limits = byKind('spendingLimit').filter((l) => monthTouchesRange(l['period'], range));
  const planIds = new Set(limits.map((l) => text(l, 'definitionId')).filter((id): id is string => id !== undefined));
  for (const l of limits) selected.add(l);
  for (const p of byKind('spendingLimitPlan')) if (p.id !== undefined && planIds.has(p.id)) selected.add(p);

  const pres = byKind('preRegistration').filter((p) => (p['date'] !== undefined ? isInRange(p['date'], range) : isInRange(p['createdAt'], range)));
  const preIds = new Set(pres.map((p) => p.id));
  for (const p of pres) selected.add(p);
  for (const a of byKind('captureAttachment')) if (preIds.has(text(a, 'preRegistrationId'))) selected.add(a);

  const parents = new Set<string>();
  for (const record of selected) {
    for (const field of PARENT_FIELDS) {
      const id = text(record, field);
      if (id !== undefined) parents.add(id);
    }
  }
  for (const record of records) {
    if ((record.kind === 'account' || record.kind === 'category') && record.id !== undefined && parents.has(record.id)) selected.add(record);
  }
  return records.filter((record) => selected.has(record));
}
