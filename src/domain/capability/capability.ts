import { type CapabilityOrigin } from './candidate.ts';
import { type CapabilityKind } from './capability.kind.ts';
import { type CapabilityStatus } from './capability.status.ts';
import { type Permission } from './permission.ts';
import { type PinnedIdentity } from './pinned.identity.ts';
import { type TrustBadge } from './trust.badge.ts';

/** Capacidade externa aprovada pelo usuario (spec 034, data-model.md 1). Local ao aparelho e ao usuario. */
export interface Capability {
  readonly id: string;
  readonly userId: string;
  readonly kind: CapabilityKind;
  readonly slug: string;
  readonly name: string;
  readonly publisher: string;
  readonly description: string;
  readonly origin: CapabilityOrigin;
  readonly badge: TrustBadge;
  readonly status: CapabilityStatus;
  readonly identity: PinnedIdentity;
  readonly permissions: readonly Permission[];
  readonly declaredEgress: readonly string[];
  /** Referencias no cofre (so os NOMES; o valor nunca fica aqui). */
  readonly credentialRefs: readonly string[];
  /** MCP: URL e host fixados; a credencial so vai a este host. */
  readonly endpoint?: { readonly url: string; readonly host: string } | undefined;
  readonly approvedAt: string;
  readonly lastUsedAt: string | null;
  readonly revokedAt: string | null;
  readonly updatedAt: string;
}
