import { autoKeyOf } from '../plan/auto.action.key.ts';
import { type PlanItem } from '../plan/plan.item.ts';
import { type AutonomyPolicy } from './autonomy.policy.ts';

export interface AutonomyDecision {
  readonly decision: 'auto' | 'approval';
  /** Motivos legiveis quando a decisao e `approval`. */
  readonly reasons: readonly string[];
}

const brl = (cents: number): string => `R$ ${(cents / 100).toFixed(2).replace('.', ',')}`;

/**
 * Decide se um plano pode ser aplicado sem o usuario (spec 033, contracts/autonomy.policy.md).
 * `auto` so quando TODAS as condicoes valem; qualquer falha pede aprovacao e diz por que.
 */
export function evaluateAutonomy(items: readonly PlanItem[], verificationComplete: boolean, policy: AutonomyPolicy): AutonomyDecision {
  const reasons: string[] = [];
  const selected = items.filter((i) => i.selected);
  if (selected.length === 0) reasons.push('nenhum item marcado');
  if (!verificationComplete) reasons.push('a verificacao nao terminou');
  const limits: number[] = [];
  for (const item of selected) {
    const key = autoKeyOf(item.kind);
    if (key === null) {
      reasons.push(`${item.kind} sempre pede aprovacao`);
      continue;
    }
    const rule = policy.rules[key];
    if (!rule.enabled) reasons.push(`${key} nao esta liberado`);
    else {
      limits.push(rule.maxItems);
      if (item.amountCents !== null && item.amountCents > rule.maxAmountCents) reasons.push(`${brl(item.amountCents)} passa do limite de ${brl(rule.maxAmountCents)}`);
    }
    if (item.flags.length > 0) reasons.push(`"${item.label}" tem alerta`);
  }
  if (limits.length > 0 && selected.length > Math.min(...limits)) reasons.push(`${selected.length} itens passa do limite de ${Math.min(...limits)} por vez`);
  return { decision: reasons.length === 0 ? 'auto' : 'approval', reasons };
}
