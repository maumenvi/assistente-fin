import { type PickedLlm } from './picked.llm.ts';
import { type RoleModels } from './role.models.ts';

/** `llm('fast')` sem perfil rapido configurado cai para o principal (FR-021). */
export function pickRoleLlm(models: RoleModels, role: 'main' | 'fast'): PickedLlm {
  if (role === 'fast' && models.fast !== undefined) return { llm: models.fast, answeredBy: 'fast' };
  return { llm: models.main, answeredBy: 'main' };
}
