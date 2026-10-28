import { z } from 'zod';
import { hasMoneyFigure } from '../../../domain/agent/summary/has.money.figure.ts';
import { type SummaryContent } from '../../../domain/agent/summary/summary.content.ts';
import { estimateTokens } from '../context/estimate.tokens.ts';

const item = (max: number) => z.string().trim().min(1).max(max);
const list = z.array(item(160)).max(12);

/** Forma do resumo (spec 032, data-model.md): limites de tamanho, uma lista curta por assunto. */
export const summaryContentSchema = z.object({
  goal: item(200),
  decisions: list,
  entities: z.array(z.object({ kind: z.enum(['account', 'category', 'card', 'period']), id: item(60), label: item(60) })).max(12),
  pending: list,
  openPlans: list,
});

/** Teto do resumo inteiro, em tokens estimados. */
export const SUMMARY_MAX_TOKENS = 600;

/** Por que um resumo foi recusado. */
export type SummaryProblem = 'shape' | 'money' | 'entity' | 'too_long';

export type SummaryValidation =
  | { readonly ok: true; readonly content: SummaryContent }
  | { readonly ok: false; readonly problem: SummaryProblem; readonly detail: string };

const PERIOD_ID = /^\d{4}-\d{2}(-\d{2})?$/;

function everyString(content: SummaryContent): string[] {
  return [content.goal, ...content.decisions, ...content.pending, ...content.openPlans, ...content.entities.flatMap((e) => [e.id, e.label])];
}

/**
 * Valida a saida do modelo como resumo (spec 032, FR-015/FR-016): forma e limites; nenhum valor
 * monetario em lugar nenhum; entidades so por identificador conhecido (contas e categorias do
 * usuario, ou periodo `AAAA-MM`) - o modelo nao inventa id; e no maximo 600 tokens.
 */
export function validateSummary(raw: unknown, allowedEntityIds: ReadonlySet<string>): SummaryValidation {
  const parsed = summaryContentSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, problem: 'shape', detail: parsed.error.issues.slice(0, 3).map((i) => `${i.path.join('.')}: ${i.message}`).join('; ') };
  const content = parsed.data;
  const withMoney = everyString(content).find(hasMoneyFigure);
  if (withMoney !== undefined) return { ok: false, problem: 'money', detail: `valor monetario em "${withMoney.slice(0, 60)}"` };
  const unknown = content.entities.find((e) => (e.kind === 'period' ? !PERIOD_ID.test(e.id) : !allowedEntityIds.has(e.id)));
  if (unknown !== undefined) return { ok: false, problem: 'entity', detail: `identificador desconhecido: ${unknown.id}` };
  if (estimateTokens(JSON.stringify(content)) > SUMMARY_MAX_TOKENS) return { ok: false, problem: 'too_long', detail: 'resumo acima de 600 tokens' };
  return { ok: true, content };
}
