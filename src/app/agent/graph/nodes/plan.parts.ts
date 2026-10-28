import { type MessagePart } from '../../../../domain/agent/message.part.ts';

/** Cartoes dos planos criados na execucao, na ordem em que nasceram. */
export function planParts(planIds: readonly string[]): MessagePart[] {
  return planIds.map((planId) => ({ type: 'plan' as const, planId }));
}
