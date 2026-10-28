import { type Intent } from '../intent.ts';
import { type ModelRole } from '../model.role.ts';
import { type LlmTier } from './llm.tier.ts';
import { roleOfTier } from './role.of.tier.ts';
import { type RoutingStrategy } from './routing.strategy.ts';

export type RoutableNodeKind = 'route' | 'react' | 'compact' | 'learn';

export interface SelectTierInput {
  readonly strategy: RoutingStrategy;
  readonly node: RoutableNodeKind;
  readonly intent: Intent | null;
  readonly stepIndex: number;
  readonly toolCallCount: number;
  readonly hasFailures: boolean;
  readonly availableTiers: ReadonlySet<LlmTier>;
}

export interface SelectedTierResult {
  readonly tier: LlmTier;
  readonly role: ModelRole;
  readonly reason: string;
}

function pickAvailable(preferredOrder: readonly LlmTier[], available: ReadonlySet<LlmTier>): LlmTier {
  for (const candidate of preferredOrder) {
    if (available.has(candidate)) return candidate;
  }
  return 'high';
}

/**
 * Seleciona dinamicamente qual dos 3 niveis de LLM (`high`, `medium`, `basic`) deve executar
 * o passo atual conforme a estrategia configurada e a complexidade da tarefa (spec 038, FR-016, FR-017).
 */
export function selectTierForStep(input: SelectTierInput): SelectedTierResult {
  const { strategy, node, intent, stepIndex, toolCallCount, hasFailures, availableTiers } = input;

  if (strategy === 'single_high') {
    const tier = pickAvailable(['high', 'medium', 'basic'], availableTiers);
    return { tier, role: roleOfTier(tier), reason: 'single_high_baseline' };
  }

  if (strategy === 'progressive_escalation') {
    if (hasFailures || intent === 'write_request' || stepIndex >= 2) {
      const tier = pickAvailable(['high', 'medium', 'basic'], availableTiers);
      return { tier, role: roleOfTier(tier), reason: 'progressive_escalated_to_high' };
    }
    if (stepIndex === 1) {
      const tier = pickAvailable(['medium', 'high', 'basic'], availableTiers);
      return { tier, role: roleOfTier(tier), reason: 'progressive_step_1_medium' };
    }
    const tier = pickAvailable(['basic', 'medium', 'high'], availableTiers);
    return { tier, role: roleOfTier(tier), reason: 'progressive_initial_basic' };
  }

  if (strategy === 'tool_heuristic') {
    if (node === 'route' || node === 'compact' || node === 'learn') {
      const tier = pickAvailable(['basic', 'medium', 'high'], availableTiers);
      return { tier, role: roleOfTier(tier), reason: 'tool_heuristic_light_node' };
    }
    if (intent === 'write_request' || toolCallCount >= 2 || hasFailures) {
      const tier = pickAvailable(['high', 'medium', 'basic'], availableTiers);
      return { tier, role: roleOfTier(tier), reason: 'tool_heuristic_complex_tools' };
    }
    const tier = pickAvailable(['medium', 'high', 'basic'], availableTiers);
    return { tier, role: roleOfTier(tier), reason: 'tool_heuristic_standard_query' };
  }

  // Default: 'hybrid_3_tiers'
  if (
    node === 'route' ||
    node === 'compact' ||
    node === 'learn' ||
    intent === 'direct' ||
    intent === 'out_of_scope' ||
    intent === 'settings_request'
  ) {
    const tier = pickAvailable(['basic', 'medium', 'high'], availableTiers);
    return { tier, role: roleOfTier(tier), reason: 'hybrid_lightweight_task' };
  }

  if (intent === 'write_request' || hasFailures || toolCallCount >= 3 || stepIndex >= 3) {
    const tier = pickAvailable(['high', 'medium', 'basic'], availableTiers);
    return { tier, role: roleOfTier(tier), reason: 'hybrid_complex_reasoning' };
  }

  const tier = pickAvailable(['medium', 'high', 'basic'], availableTiers);
  return { tier, role: roleOfTier(tier), reason: 'hybrid_standard_query' };
}

