import { type Capability } from '../capability.ts';
import { moveCapability } from './transition.ts';

/** Revoga (terminal): quem chama apaga credenciais e arquivos de skill e fecha a sessao. */
export function revokeCapability(capability: Capability, now: Date): Capability {
  return moveCapability(capability, 'revoked', now, { revokedAt: now.toISOString(), credentialRefs: [] });
}
