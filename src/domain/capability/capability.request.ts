import { type Candidate } from './candidate.ts';

export const REQUEST_STATUSES = ['pending', 'approved', 'rejected', 'expired', 'failed', 'superseded'] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

/** Validade de um pedido pendente. */
export const REQUEST_VALIDITY_HOURS = 24;

/** O que mudou numa nova aprovacao (identidade alterada ou egress maior que o declarado). */
export interface RequestDiff {
  readonly added: readonly string[];
  readonly removed: readonly string[];
  readonly changed: readonly string[];
  readonly extraInputs: readonly string[];
}

/** Pedido de capacidade: o cartao de aprovacao pendente (data-model.md 2). */
export interface CapabilityRequest {
  readonly id: string;
  readonly userId: string;
  readonly conversationId: string;
  readonly runId: string | null;
  readonly messageId: string | null;
  readonly status: RequestStatus;
  readonly candidate: Candidate;
  /** Motivo escrito pelo modelo (<= 300): mostrado rotulado, nunca usado para decidir nada. */
  readonly reason: string;
  /** Preenchido numa reaprovacao: a capacidade que mudou. */
  readonly replacesCapabilityId: string | null;
  readonly diff: RequestDiff | null;
  readonly createdAt: string;
  readonly expiresAt: string;
  readonly decidedAt: string | null;
  readonly lastError: string | null;
}
