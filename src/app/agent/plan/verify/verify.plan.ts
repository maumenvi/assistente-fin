import { defaultSelected } from '../../../../domain/plan/lifecycle/default.selection.ts';
import { fingerprint } from '../../../../domain/plan/lifecycle/fingerprint.ts';
import { MIN_SELECT_CONFIDENCE } from '../../../../domain/plan/plan.settings.ts';
import { type PlanFlag } from '../../../../domain/plan/plan.flag.ts';
import { type PlanItem } from '../../../../domain/plan/plan.item.ts';
import { type PreparedOperation } from '../operations/operation.adapter.ts';
import { operationOf } from '../operations/operation.registry.ts';
import { readSnapshot } from '../operations/touch.snapshot.ts';
import { checkDate } from './check.dates.ts';
import { checkDivergence } from './check.divergence.ts';
import { checkDuplicates } from './check.duplicates.ts';
import { checkCardLimit } from './check.limits.ts';
import { type VerifyContext } from './verify.context.ts';

/** Item proposto ja preparado pelo adaptador, antes da verificacao. */
export interface DraftItem {
  readonly id: string;
  readonly kind: PlanItem['kind'];
  readonly prepared: PreparedOperation;
  readonly confidence: number;
  readonly source: 'model' | 'rule';
}

export interface VerifiedPlan {
  readonly items: readonly PlanItem[];
  /** Itens descartados (posicao no rascunho e motivo), devolvidos ao modelo. */
  readonly rejected: readonly { readonly index: number; readonly reason: string }[];
  /** Falso quando uma consulta externa (duplicata, limite) falhou: o plano sai da autonomia. */
  readonly complete: boolean;
}

/**
 * Verifica o rascunho antes de apresentar (spec 033, contracts/verify.plan.md): datas, duplicatas,
 * limite de cartao, divergencia do pedido e confianca. Item invalido sai; os demais ganham alertas
 * e a selecao padrao (so o confiavel e sem alerta vem marcado).
 */
export async function verifyPlan(drafts: readonly DraftItem[], ctx: VerifyContext): Promise<VerifiedPlan> {
  const rejected: { index: number; reason: string }[] = [];
  const valid: { draft: DraftItem; index: number }[] = [];
  drafts.forEach((draft, index) => {
    const reason = checkDate(draft.prepared.input, ctx.now);
    if (reason === null) valid.push({ draft, index });
    else rejected.push({ index, reason });
  });

  let complete = true;
  let duplicates = new Map<string, PlanFlag>();
  try {
    duplicates = await checkDuplicates(valid.map((v) => ({ kind: v.draft.kind, input: v.draft.prepared.input, itemId: v.draft.id })), ctx);
  } catch {
    complete = false;
  }

  const items: PlanItem[] = [];
  for (const { draft } of valid) {
    const flags: PlanFlag[] = [...draft.prepared.flags];
    const duplicate = duplicates.get(draft.id);
    if (duplicate !== undefined) flags.push(duplicate);
    try {
      const limit = await checkCardLimit(draft.kind, draft.prepared.input, ctx);
      if (limit !== null) flags.push(limit);
    } catch {
      complete = false;
    }
    flags.push(...checkDivergence(draft.prepared.input, ctx.userText, ctx.knownMoneyCents));
    if (draft.confidence < MIN_SELECT_CONFIDENCE) flags.push({ flag: 'low_confidence', text: 'confianca baixa na interpretacao' });
    const adapter = operationOf(draft.kind);
    const snapshots = adapter === undefined ? [] : await Promise.all(draft.prepared.watch.map((ref) => readSnapshot(ctx.db, ctx.userId, ref)));
    items.push({
      id: draft.id, kind: draft.kind, input: draft.prepared.input, label: draft.prepared.preview.label, amountCents: draft.prepared.preview.amountCents,
      before: draft.prepared.preview.before, after: draft.prepared.preview.after, confidence: draft.confidence, flags,
      selected: defaultSelected(draft.confidence, flags), source: draft.source, beforeFingerprint: fingerprint(snapshots),
    });
  }
  return { items, rejected, complete };
}
