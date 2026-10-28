import { isValidSlug } from '../../../../domain/capability/lifecycle/qualified.name.ts';
import { type CapabilityEngineDeps } from './engine.deps.ts';

/** Slug livre para o usuario: o do candidato ou com sufixo `-2`, `-3`... (revogadas guardam o slug no historico). */
export async function freeSlug(deps: CapabilityEngineDeps, userId: string, base: string): Promise<string> {
  const root = isValidSlug(base) ? base : base.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 36) || 'capacidade';
  let candidate = isValidSlug(root) ? root : `c-${root}`;
  for (let n = 2; (await deps.stores.capabilities.getBySlug(userId, candidate)) !== null; n += 1) candidate = `${root.slice(0, 36)}-${String(n)}`;
  return candidate;
}
