import { CapabilityInvalidTransitionError } from '../errors/capability.invalid.transition.error.ts';
import { type Capability } from '../capability.ts';
import { type CapabilityStatus } from '../capability.status.ts';

const ALLOWED: Readonly<Record<CapabilityStatus, readonly CapabilityStatus[]>> = {
  active: ['paused', 'needs_review', 'revoked'],
  paused: ['active', 'needs_review', 'revoked'],
  needs_review: ['active', 'revoked'],
  revoked: [],
};

export function canTransition(from: CapabilityStatus, to: CapabilityStatus): boolean {
  return ALLOWED[from].includes(to);
}

/** Move a capacidade de estado ou lanca `CapabilityInvalidTransitionError` (data-model.md 1). */
export function moveCapability(capability: Capability, to: CapabilityStatus, now: Date, patch: Partial<Capability> = {}): Capability {
  if (!canTransition(capability.status, to)) throw new CapabilityInvalidTransitionError(`${capability.status} -> ${to}`);
  return { ...capability, ...patch, status: to, updatedAt: now.toISOString() };
}
