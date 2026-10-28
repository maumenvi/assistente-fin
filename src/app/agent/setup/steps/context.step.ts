import { CONTEXT_REQUIREMENTS } from '../../../../domain/agent/connection/context.requirements.ts';
import { type ConnectionStep } from '../../../../domain/agent/connection/connection.step.ts';

/** Etapa do contexto a partir dos tokens detectados (`null` = nao deu para saber). */
export function contextStep(tokens: number | null): ConnectionStep {
  const { minTokens, recommendedTokens } = CONTEXT_REQUIREMENTS;
  if (tokens === null) return { id: 'context', status: 'warn', code: 'context.unknown' };
  const detail = { tokens, min: minTokens, recommended: recommendedTokens };
  if (tokens >= recommendedTokens) return { id: 'context', status: 'ok', code: 'context.ok', detail };
  if (tokens >= minTokens) return { id: 'context', status: 'warn', code: 'context.short', detail };
  return { id: 'context', status: 'failed', code: 'context.too_small', detail };
}
