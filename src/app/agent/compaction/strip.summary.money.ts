import { stripMoneyFigures } from '../../../domain/agent/summary/strip.money.figures.ts';
import { type SummaryContent } from '../../../domain/agent/summary/summary.content.ts';

/** Ultimo recurso (spec 032, research P8): troca todo valor monetario do resumo por `[valor]`. */
export function stripSummaryMoney(content: SummaryContent): SummaryContent {
  const clean = (text: string): string => stripMoneyFigures(text);
  return {
    goal: clean(content.goal),
    decisions: content.decisions.map(clean),
    entities: content.entities.map((e) => ({ ...e, label: clean(e.label) })),
    pending: content.pending.map(clean),
    openPlans: content.openPlans.map(clean),
  };
}
