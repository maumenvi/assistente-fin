import { type Capability } from '../capability.ts';
import { moveCapability } from './transition.ts';

/** A identidade mudou: bloqueia o uso ate nova aprovacao. */
export function markNeedsReview(capability: Capability, now: Date): Capability {
  return moveCapability(capability, 'needs_review', now);
}
