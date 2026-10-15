import { type ImportConflictDecision } from './import.conflict.decision.ts';
import { recordKey, type ImportPlan } from './plan.period.import.ts';
import { type PortableRecord } from './portable.record.ts';
import { UnresolvedImportConflictError } from './unresolved.import.conflict.error.ts';

/** Grupos que viajam juntos: copiar um membro copia o grupo inteiro. */
const GROUP_FIELDS = ['installmentGroupId', 'seriesId', 'transferGroupId', 'cardPaymentGroupId'] as const;
/** Campos que guardam ids de outros records (remapeados quando o alvo e copiado). */
const REFERENCE_FIELDS = ['accountId', 'categoryId', 'incomeId', 'fixedExpenseId', 'definitionId', 'preRegistrationId', 'possibleDuplicateOf', ...GROUP_FIELDS] as const;

/**
 * Aplica as decisoes ao plano (spec 022, T142; FR-018) e devolve os records a gravar, na ordem do
 * arquivo:
 *
 * - `new` -> grava; `identical` -> pula; conflito `keep-current` -> pula, `replace` -> grava por
 *   cima;
 * - `keep-both` -> o record ganha id novo, e com ele o grupo inteiro (parcelas, serie,
 *   transferencia, pagamento de fatura), com as referencias do arquivo remapeadas. Categoria
 *   copiada ganha " (importada)" no nome (nome de categoria e unico).
 *
 * Conflito sem decisao e sem `defaultDecision` -> `UnresolvedImportConflictError`.
 */
export function resolvePeriodImport(
  plan: ImportPlan,
  decisions: Readonly<Record<string, ImportConflictDecision>>,
  defaultDecision: ImportConflictDecision | undefined,
  newId: () => string,
): PortableRecord[] {
  const decisionOf = new Map<string, ImportConflictDecision>();
  const missing: string[] = [];
  for (const conflict of plan.conflicts) {
    const decision = decisions[conflict.conflictId] ?? defaultDecision;
    if (decision === undefined) missing.push(conflict.conflictId);
    else decisionOf.set(conflict.conflictId, decision);
  }
  if (missing.length > 0) throw new UnresolvedImportConflictError(missing);

  // ids e grupos a copiar
  const idMap = new Map<string, string>();
  const copiedGroups = new Map<string, Set<string>>(GROUP_FIELDS.map((field) => [field, new Set<string>()]));
  for (const conflict of plan.conflicts) {
    if (decisionOf.get(conflict.conflictId) !== 'keep-both') continue;
    idMap.set(conflict.id, newId());
    for (const field of GROUP_FIELDS) {
      const group = conflict.incoming[field];
      if (typeof group === 'string' && group !== '') copiedGroups.get(field)!.add(group);
    }
    if (conflict.kind === 'transactionSeries') copiedGroups.get('seriesId')!.add(conflict.id);
  }
  const inCopiedGroup = (record: PortableRecord) =>
    GROUP_FIELDS.some((field) => {
      const group = record[field];
      return typeof group === 'string' && copiedGroups.get(field)!.has(group);
    }) || (record.kind === 'transactionSeries' && record.id !== undefined && copiedGroups.get('seriesId')!.has(record.id));
  for (const record of plan.incoming) {
    if (record.id !== undefined && !idMap.has(record.id) && inCopiedGroup(record)) idMap.set(record.id, newId());
  }
  for (const field of GROUP_FIELDS) for (const group of copiedGroups.get(field)!) if (!idMap.has(group)) idMap.set(group, newId());

  const writes: PortableRecord[] = [];
  for (const record of plan.incoming) {
    const key = recordKey(record)!;
    const copied = record.id !== undefined && idMap.has(record.id);
    const decision = decisionOf.get(key);
    const write = copied || plan.newIds.has(key) || decision === 'replace';
    if (!write) continue;
    const remapped: Record<string, unknown> = { ...record };
    if (copied) remapped['id'] = idMap.get(record.id!);
    for (const field of REFERENCE_FIELDS) {
      const value = record[field];
      if (typeof value === 'string' && idMap.has(value)) remapped[field] = idMap.get(value);
    }
    if (copied && record.kind === 'category' && typeof record['name'] === 'string') remapped['name'] = `${record['name']} (importada)`;
    writes.push(remapped as PortableRecord);
  }
  return writes;
}
