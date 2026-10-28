import { type Candidate } from '../../../../domain/capability/candidate.ts';
import { type Capability } from '../../../../domain/capability/capability.ts';
import { headerOfRef } from './credential.auth.ts';

/** Candidato reconstruido de uma capacidade ja aprovada (para o pedido de reaprovacao quando ela muda). */
export function candidateOf(capability: Capability, platform: 'desktop' | 'android'): Candidate {
  return {
    kind: capability.kind,
    slug: capability.slug,
    name: capability.name,
    publisher: capability.publisher,
    description: capability.description,
    origin: capability.origin,
    badge: capability.badge,
    ...(capability.endpoint === undefined ? {} : { endpointUrl: capability.endpoint.url }),
    transport: capability.kind === 'skill' ? 'skill' : 'streamable-http',
    declaredEgress: capability.declaredEgress,
    permissions: capability.permissions,
    credentialSpec: capability.credentialRefs.map((ref) => ({ name: headerOfRef(ref), label: headerOfRef(ref), secret: true, header: headerOfRef(ref) })),
    platforms: [platform],
  };
}
