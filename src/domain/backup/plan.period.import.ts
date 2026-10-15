import { canonicalJson } from './canonical.json.ts';
import { type PortableRecord } from './portable.record.ts';

/** Um conflito: mesmo `kind + id`, conteudo diferente. */
export interface ImportConflict {
  /** `kind:id`. */
  readonly conflictId: string;
  readonly kind: string;
  readonly id: string;
  readonly current: PortableRecord;
  readonly incoming: PortableRecord;
}

/** Plano de importacao (spec 022, data-model "PeriodBackupPlan"): nada e gravado para faze-lo. */
export interface ImportPlan {
  readonly incoming: readonly PortableRecord[];
  readonly newIds: ReadonlySet<string>;
  readonly identicalIds: ReadonlySet<string>;
  readonly conflicts: readonly ImportConflict[];
}

/** Chave de identidade de um record. */
export function recordKey(record: PortableRecord): string | null {
  return record.id === undefined ? null : `${record.kind}:${record.id}`;
}

/**
 * Classifica os records do arquivo contra os que ja existem (spec 022, T142; FR-018): `new`
 * (nao existe), `identical` (mesmo conteudo, ignorando `updatedAt` - pulado sem pergunta) ou
 * `conflict` (mesma identidade, conteudo diferente). Records sem id (o `header`) nao entram.
 */
export function planPeriodImport(existing: readonly PortableRecord[], incoming: readonly PortableRecord[]): ImportPlan {
  const current = new Map<string, PortableRecord>();
  for (const record of existing) {
    const key = recordKey(record);
    if (key !== null) current.set(key, record);
  }
  const newIds = new Set<string>();
  const identicalIds = new Set<string>();
  const conflicts: ImportConflict[] = [];
  const kept: PortableRecord[] = [];
  for (const record of incoming) {
    const key = recordKey(record);
    if (key === null) continue;
    kept.push(record);
    const mine = current.get(key);
    if (mine === undefined) newIds.add(key);
    else if (canonicalJson(mine) === canonicalJson(record)) identicalIds.add(key);
    else conflicts.push({ conflictId: key, kind: record.kind, id: record.id!, current: mine, incoming: record });
  }
  return { incoming: kept, newIds, identicalIds, conflicts };
}
