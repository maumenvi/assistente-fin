import { type Capability } from '../capability.ts';
import { moveCapability } from './transition.ts';

/** Pausa: o agente deixa de usar, sem apagar a configuracao. */
export function pauseCapability(capability: Capability, now: Date): Capability {
  return moveCapability(capability, 'paused', now);
}
