import { type Candidate } from '../candidate.ts';
import { type Capability } from '../capability.ts';
import { type PinnedIdentity } from '../pinned.identity.ts';
import { parseHttpUrl } from '../url.host.ts';
import { moveCapability } from './transition.ts';

/** Capacidade ativa nascida da aprovacao de um candidato (identidade ja fixada pela conexao/teste). */
export function newActiveCapability(input: { id: string; userId: string; candidate: Candidate; identity: PinnedIdentity; credentialRefs: readonly string[]; now: Date }): Capability {
  const { candidate, now } = input;
  const iso = now.toISOString();
  return {
    id: input.id,
    userId: input.userId,
    kind: candidate.kind,
    slug: candidate.slug,
    name: candidate.name,
    publisher: candidate.publisher,
    description: candidate.description,
    origin: candidate.origin,
    badge: candidate.badge,
    status: 'active',
    identity: input.identity,
    permissions: candidate.permissions,
    declaredEgress: candidate.declaredEgress,
    credentialRefs: input.credentialRefs,
    ...(candidate.endpointUrl === undefined ? {} : { endpoint: { url: candidate.endpointUrl, host: parseHttpUrl(candidate.endpointUrl)?.host ?? candidate.endpointUrl } }),
    approvedAt: iso,
    lastUsedAt: null,
    revokedAt: null,
    updatedAt: iso,
  };
}

/** Nova aprovacao de capacidade que estava em `needs_review`: fixa a nova identidade e reativa. */
export function reapproveCapability(capability: Capability, identity: PinnedIdentity, now: Date): Capability {
  return moveCapability(capability, 'active', now, { identity, approvedAt: now.toISOString() });
}
