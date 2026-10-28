export const CAPABILITY_STATUSES = ['active', 'paused', 'revoked', 'needs_review'] as const;

/** `needs_review`: a identidade fixada mudou; nao e usada ate nova aprovacao. `revoked` e terminal. */
export type CapabilityStatus = (typeof CAPABILITY_STATUSES)[number];
