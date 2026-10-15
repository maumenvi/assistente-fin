import { type SyncOp } from '../sync/sync.op.ts';
import { type SyncOpResult } from '../sync/sync.op.result.ts';
import { CAPTURE_ORIGINS } from './capture.origins.ts';
import { type NewCapture } from './new.capture.ts';

/**
 * Escolhe, de um lote de push ja aplicado, as capturas novas do celular (spec 013, RF-12,
 * contracts/sync.push.capture.notification.md): upsert de criacao (`baseVersion === null`) de
 * pre-registro com origem de captura e resultado `applied`. `duplicate` (reenvio), `conflict`,
 * `rejected`, exclusoes, edicoes e demais entidades ficam de fora. O resultado e casado pelo
 * `opId`; a ordem das operacoes e mantida.
 */
export function selectNewCaptures(ops: readonly SyncOp[], results: readonly SyncOpResult[]): NewCapture[] {
  const statusByOpId = new Map(results.map((result) => [result.opId, result.status]));
  const captureOrigins: readonly string[] = CAPTURE_ORIGINS;
  const captures: NewCapture[] = [];
  for (const op of ops) {
    if (op.entity !== 'preRegistration' || op.kind !== 'upsert' || op.baseVersion !== null) continue;
    if (statusByOpId.get(op.opId) !== 'applied') continue;
    const record = op.record;
    if (record?.kind !== 'preRegistration' || !captureOrigins.includes(record.origin)) continue;
    const description = record.description?.trim() ?? '';
    captures.push({ amountCents: record.amountCents ?? null, description: description === '' ? null : description });
  }
  return captures;
}
