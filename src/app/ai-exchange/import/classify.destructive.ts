import { type AgentOp } from '../format/agent.op.ts';
import { type Inspection, type DisplayValue } from './operation.handler.ts';
import { type PlannedChange } from './planned.op.ts';

/** Normaliza para comparar: datas ISO viram `YYYY-MM-DD`; numeros e textos ficam como estao. */
function normalize(value: unknown): DisplayValue {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) return value.slice(0, 10);
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' || value === null) return value;
  return null;
}

/** Os campos de `data` que mudam um valor atual, como "atual -> novo". */
export function diffChanges(op: AgentOp, inspection: Inspection): PlannedChange[] {
  const changes: PlannedChange[] = [];
  for (const [field, value] of Object.entries(op.data ?? {})) {
    const to = normalize(value);
    const from = field in inspection.display ? (inspection.display[field] ?? null) : null;
    if (from !== to) changes.push({ field, from, to });
  }
  return changes;
}

/**
 * Destrutivo = apagar, cancelar as restantes, ou `update` que muda de fato o valor, a data ou a
 * descricao de um registro que ja existe (spec 029, FR-006, A1). Categoria, conta, pago e
 * observacoes sao seguros. Mudar para o mesmo valor nao e substituir nada.
 */
export function isDestructiveOp(op: AgentOp, destructiveFields: readonly string[], inspection: Inspection): boolean {
  if (op.kind === 'delete' || op.kind === 'cancelRemaining') return true;
  if (op.kind !== 'update') return false;
  return diffChanges(op, inspection).some((change) => destructiveFields.includes(change.field));
}
