import { type ModelRole } from '../model.role.ts';
import { type LlmTier } from './llm.tier.ts';

/**
 * Mapeia um `LlmTier` (`high`, `medium`, `basic`) para o `ModelRole` correspondente (`main`, `fast`, `fallback`),
 * preservando compatibilidade com os perfis salvos (spec 038).
 */
export function roleOfTier(tier: LlmTier): ModelRole {
  if (tier === 'high') return 'main';
  if (tier === 'medium') return 'fast';
  return 'fallback';
}

/** Converte um `ModelRole` (`main`, `fast`, `fallback`) para seu `LlmTier` (`high`, `medium`, `basic`). */
export function tierOfRole(role: ModelRole): LlmTier {
  if (role === 'main') return 'high';
  if (role === 'fast') return 'medium';
  return 'basic';
}

