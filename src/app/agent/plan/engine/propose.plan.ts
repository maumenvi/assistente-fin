import { evaluateAutonomy } from '../../../../domain/autonomy/evaluate.autonomy.ts';
import { PlanInvalidOperationError } from '../../../../domain/plan/errors/plan.invalid.operation.error.ts';
import { MAX_PLAN_ITEMS } from '../../../../domain/plan/plan.settings.ts';
import { type Plan } from '../../../../domain/plan/plan.ts';
import { type PlanItem } from '../../../../domain/plan/plan.item.ts';
import { rejectPlan } from '../../../../domain/plan/lifecycle/reject.plan.ts';
import { operationOf } from '../operations/operation.registry.ts';
import { type DraftItem, verifyPlan } from '../verify/verify.plan.ts';
import { applyRule } from '../rules/apply.rules.ts';
import { applyPlan } from './apply.plan.ts';
import { loadPolicy, operationContext, savePlan } from './engine.helpers.ts';
import { type PlanEngineDeps } from './plan.engine.deps.ts';

export interface ProposedOperation {
  /** Argumentos da operacao, com o `kind`. */
  readonly raw: Readonly<Record<string, unknown>>;
  /** Confianca do modelo (0..1); padrao 0,9. */
  readonly confidence?: number | undefined;
}

export interface ProposePlanInput {
  readonly userId: string;
  readonly conversationId: string;
  readonly runId: string | null;
  readonly messageId: string | null;
  readonly userText: string;
  readonly summary: string;
  readonly operations: readonly ProposedOperation[];
  /** Valores (centavos) ja vistos em consultas desta execucao. */
  readonly knownMoneyCents?: ReadonlySet<number> | undefined;
  /** Plano pendente que este substitui (ajuste por texto): vira `rejected`. */
  readonly replacesPlanId?: string | undefined;
  /** Anexo de onde os itens vieram (spec 036): os itens ganham a origem, nunca sao aplicados sozinhos e, se for imagem, vem desmarcados. */
  readonly attachment?: { readonly id: string; readonly name: string; readonly fromImage: boolean } | undefined;
}

export type ProposePlanResult =
  | { readonly ok: true; readonly plan: Plan; readonly rejected: readonly { index: number; reason: string }[] }
  | { readonly ok: false; readonly reasons: readonly { index: number; reason: string }[] };

const DEFAULT_CONFIDENCE = 0.9;

const IMAGE_FLAG = { flag: 'low_confidence' as const, text: 'Conferir: li da imagem' };

/** Marca o item como vindo de um anexo; valor lido de imagem nao e fato do app: vem com alerta e desmarcado. */
function markFromAttachment(item: PlanItem, attachment: NonNullable<ProposePlanInput['attachment']>): PlanItem {
  const marked: PlanItem = { ...item, origin: 'attachment', attachmentId: attachment.id };
  return attachment.fromImage ? { ...marked, selected: false, flags: [...item.flags.filter((f) => f.text !== IMAGE_FLAG.text), IMAGE_FLAG] } : marked;
}

/**
 * Monta, verifica e salva o plano (spec 033, contracts/plan.engine.md). Nunca grava dado financeiro
 * por conta propria: ou fica `pending` esperando o usuario, ou, se a politica permitir TUDO, aplica.
 */
export async function proposePlan(deps: PlanEngineDeps, input: ProposePlanInput): Promise<ProposePlanResult> {
  if (input.operations.length > MAX_PLAN_ITEMS) throw new PlanInvalidOperationError(`plano com mais de ${MAX_PLAN_ITEMS} itens`);
  const now = deps.clock.now();
  const ctx = operationContext(deps, input.userId);
  const drafts: DraftItem[] = [];
  const rejected: { index: number; reason: string }[] = [];
  const origin: number[] = []; // posicao no pedido de cada rascunho
  for (const [index, op] of input.operations.entries()) {
    const kind = String(op.raw['kind'] ?? '');
    const adapter = operationOf(kind);
    if (adapter === undefined) {
      rejected.push({ index, reason: `operacao desconhecida: ${kind || '(vazia)'}` });
      continue;
    }
    const ruled = await applyRule({ db: deps.db, clock: deps.clock, ids: deps.ids }, input.userId, op.raw);
    const prepared = await adapter.prepare(ruled?.raw ?? op.raw, ctx);
    if (!prepared.ok) {
      rejected.push({ index, reason: prepared.reason });
      continue;
    }
    origin.push(index);
    const value = ruled === null ? prepared.value : { ...prepared.value, preview: { ...prepared.value.preview, label: `${prepared.value.preview.label} (${ruled.label})` }, flags: ruled.flag === null ? prepared.value.flags : [...prepared.value.flags, ruled.flag] };
    drafts.push({ id: deps.ids.next(), kind: adapter.kind, prepared: value, confidence: ruled?.confidence ?? op.confidence ?? DEFAULT_CONFIDENCE, source: ruled === null ? 'model' : 'rule' });
  }

  const verified = await verifyPlan(drafts, { ...ctx, userText: input.userText, knownMoneyCents: input.knownMoneyCents ?? new Set(), deps: deps.toolDeps });
  for (const r of verified.rejected) rejected.push({ index: origin[r.index] ?? r.index, reason: r.reason });
  if (verified.items.length === 0) return { ok: false, reasons: rejected.sort((a, b) => a.index - b.index) };

  const items = input.attachment === undefined ? verified.items : verified.items.map((item) => markFromAttachment(item, input.attachment as NonNullable<ProposePlanInput['attachment']>));
  const policy = await loadPolicy(deps, input.userId);
  const pending: Plan = {
    id: deps.ids.next(), userId: input.userId, conversationId: input.conversationId, runId: input.runId, messageId: input.messageId,
    status: 'pending', origin: 'user', summary: input.summary.slice(0, 200), userText: input.userText.slice(0, 1000), items,
    createdAt: now.toISOString(), expiresAt: new Date(now.getTime() + policy.validityHours * 3_600_000).toISOString(),
    decidedAt: null, appliedAt: null, revertUntil: null, revertedAt: null, lastError: null, applications: [],
  };

  if (input.replacesPlanId !== undefined) {
    const old = await deps.db.plans.plans.get(input.userId, input.replacesPlanId);
    if (old !== null && old.status === 'pending') await savePlan(deps, rejectPlan(old, now));
  }

  const saved = await savePlan(deps, pending);
  const decision = evaluateAutonomy(saved.items, verified.complete, policy);
  // itens vindos de anexo sempre esperam a aprovacao do usuario, mesmo com a autonomia de lancar ligada (spec 036, R8)
  const plan = decision.decision === 'auto' && input.attachment === undefined ? await applyPlan(deps, saved, 'policy') : saved;
  return { ok: true, plan, rejected: rejected.sort((a, b) => a.index - b.index) };
}
