import { type Capability } from '../capability.ts';
import { moveCapability } from './transition.ts';

/** Retoma uma capacidade pausada (quem chama reverifica a identidade antes de usar). */
export function resumeCapability(capability: Capability, now: Date): Capability {
  return moveCapability(capability, 'active', now);
}
